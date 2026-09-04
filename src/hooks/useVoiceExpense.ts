// ─────────────────────────────────────────────────────────────────
// useVoiceExpense.ts — Voice lifecycle controller with 2-second
// auto-commit safety gate. Bridges speech → parser → database.
// ─────────────────────────────────────────────────────────────────

import { useState, useCallback, useRef, useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
  startOfflineRecognition,
  stopRecognition,
  checkOfflineModelStatus,
  type OfflineSTTError,
} from '../lib/offlineSpeech';
import { parseVoiceInput, type ParseResult } from '../lib/voiceParser';
import { addExpense, addPoolDeposit } from '../lib/database';
import { computeEqualSplit } from '../lib/debt';
import { audioParseSuccess, audioParseError } from '../lib/audioFeedback';
import type { Trip } from '../types';

// ── Types ──────────────────────────────────────────────────────────

export interface VoiceState {
  isRecording: boolean;
  rawTranscript: string;
  parsedResult: ParseResult | null;
  countdown: number; // seconds remaining (2.0 → 0.0)
  error: string | null;
  stage: 'idle' | 'listening' | 'parsed' | 'committing' | 'error';
}

export type { ParseResult };

// ── Constants ──────────────────────────────────────────────────────

const COUNTDOWN_DURATION = 2.0; // seconds
const COUNTDOWN_TICK_MS = 100; // update interval

// ── Hook ───────────────────────────────────────────────────────────

export function useVoiceExpense(
  currentTrip: Trip | null,
  onCommitSuccess: () => void
) {
  const [state, setState] = useState<VoiceState>({
    isRecording: false,
    rawTranscript: '',
    parsedResult: null,
    countdown: 0,
    error: null,
    stage: 'idle',
  });

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const parsedResultRef = useRef<ParseResult | null>(null);
  const transcriptRef = useRef('');
  const tripRef = useRef(currentTrip);
  tripRef.current = currentTrip;

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // ── Audio interruption: pause on app backgrounding ────────────
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        // App going to background — stop recording, dismiss HUD quietly
        stopRecognition();
        if (countdownRef.current) {
          // Don't commit silently — just dismiss to avoid stale writes
          clearCountdown();
          parsedResultRef.current = null;
          transcriptRef.current = '';
          setState((prev) => ({
            ...prev,
            isRecording: false,
            stage: 'idle',
            countdown: 0,
          }));
        }
      }
    });
    return () => subscription?.remove();
  }, []);

  const clearCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const startCountdown = useCallback(
    (result: ParseResult, transcript: string) => {
      clearCountdown();
      parsedResultRef.current = result;
      transcriptRef.current = transcript;

      setState((prev) => ({
        ...prev,
        stage: 'parsed',
        parsedResult: result,
        rawTranscript: transcript,
        countdown: COUNTDOWN_DURATION,
        error: null,
      }));

      let remaining = COUNTDOWN_DURATION;
      countdownRef.current = setInterval(() => {
        remaining -= COUNTDOWN_TICK_MS / 1000;

        if (remaining <= 0) {
          clearCountdown();
          // Auto-commit
          executeCommit(parsedResultRef.current, transcriptRef.current);
          return;
        }

        setState((prev) => ({ ...prev, countdown: Math.round(remaining * 10) / 10 }));
      }, COUNTDOWN_TICK_MS);
    },
    [clearCountdown]
  );

  const executeCommit = useCallback(
    async (result: ParseResult | null, transcript: string) => {
      if (!result) return;
      const trip = tripRef.current;
      if (!trip) {
        setState((prev) => ({
          ...prev,
          stage: 'error',
          error: 'No active trip. Create or select one first.',
          countdown: 0,
        }));
        return;
      }

      setState((prev) => ({ ...prev, stage: 'committing', countdown: 0 }));

      try {
        if (result.type === 'expense' && result.intent === 'ADD_EXPENSE') {
          // Determine payer
          let payerId: string;
          if (result.payer && result.payer !== '__SELF__') {
            const member = trip.members.find(
              (m) => m.name.toLowerCase() === result.payer!.toLowerCase() ||
                     m.name.toLowerCase().startsWith(result.payer!.toLowerCase())
            );
            payerId = member?.id ?? trip.members[0]?.id ?? '__SELF__';
          } else {
            payerId = trip.members[0]?.id ?? '__SELF__';
          }

          // Compute splits
          let splits;
          if (result.isPersonal || result.splitMode === 'none') {
            splits = [{ memberId: payerId, amount: result.amount }];
          } else if (result.splitMode === 'exact') {
            splits = Object.entries(result.exactSplits).map(([name, amount]) => {
              const member = trip.members.find(
                (m) => m.name.toLowerCase().startsWith(name.toLowerCase())
              );
              return { memberId: member?.id ?? payerId, amount };
            });
          } else {
            // Equal split
            const targetIds = result.splitMembers.length > 0
              ? result.splitMembers
                  .map((name) => {
                    if (name === '__SELF__') return payerId;
                    const m = trip.members.find(
                      (mm) => mm.name.toLowerCase() === name.toLowerCase() ||
                              mm.name.toLowerCase().startsWith(name.toLowerCase())
                    );
                    return m?.id;
                  })
                  .filter((id): id is string => !!id)
              : trip.members.map((m) => m.id);

            splits = computeEqualSplit(
              result.amount,
              targetIds.length > 0 ? targetIds : trip.members.map((m) => m.id)
            );
          }

          await addExpense(
            trip.id,
            result.title,
            result.amount,
            payerId,
            splits,
            result.category
          );
        } else if (result.type === 'pool' && result.intent === 'POOL_DEPOSIT') {
          const depositMemberId = result.payerId ?? trip.members[0]?.id;
          if (depositMemberId) {
            await addPoolDeposit(trip.id, depositMemberId, result.amount);
          }
        }
        // Queries and commands don't write to DB

        await audioParseSuccess();
        onCommitSuccess();
        resetState();
      } catch (err: any) {
        await audioParseError();
        setState((prev) => ({
          ...prev,
          stage: 'error',
          error: `Write failed: ${err?.message ?? 'unknown error'}`,
          countdown: 0,
        }));
      }
    },
    [onCommitSuccess]
  );

  const resetState = useCallback(() => {
    clearCountdown();
    parsedResultRef.current = null;
    transcriptRef.current = '';
    setState({
      isRecording: false,
      rawTranscript: '',
      parsedResult: null,
      countdown: 0,
      error: null,
      stage: 'idle',
    });
  }, [clearCountdown]);

  const startRecording = useCallback(async () => {
    // ── Rapid-fire debounce: commit pending transaction first ──
    // If a countdown is active, immediately commit it before starting new recording.
    if (parsedResultRef.current && countdownRef.current) {
      clearCountdown();
      await executeCommit(parsedResultRef.current, transcriptRef.current);
    }

    resetState();

    // Pre-flight: verify offline model
    const modelStatus = await checkOfflineModelStatus();
    if (!modelStatus.available) {
      setState((prev) => ({
        ...prev,
        stage: 'error',
        error: modelStatus.message,
      }));
      return;
    }

    setState((prev) => ({ ...prev, isRecording: true, stage: 'listening' }));

    try {
      const result = await startOfflineRecognition();
      const trip = tripRef.current;
      const memberNames = trip?.members.map((m) => m.name) ?? [];

      const parsed = parseVoiceInput(result.transcript, {
        memberNames,
        leaderId: trip?.members[0]?.id ?? null,
        currentUserId: trip?.members[0]?.id ?? '__SELF__',
      });

      // For queries and commands, execute immediately (no countdown)
      if (parsed.type === 'query' || parsed.type === 'command') {
        await audioParseSuccess();
        setState((prev) => ({
          ...prev,
          isRecording: false,
          rawTranscript: result.transcript,
          parsedResult: parsed,
          stage: 'parsed',
          countdown: 0,
        }));
        return;
      }

      // For expenses and pool operations, start the safety window
      setState((prev) => ({ ...prev, isRecording: false }));
      startCountdown(parsed, result.transcript);
    } catch (err: any) {
      const sttError = err as OfflineSTTError;
      await audioParseError();
      setState((prev) => ({
        ...prev,
        isRecording: false,
        stage: 'error',
        error: sttError?.isOfflineModelMissing
          ? sttError.message
          : sttError?.code === 'no-speech'
            ? 'No speech detected. Try again.'
            : sttError?.message || 'Recognition failed.',
        countdown: 0,
      }));
    }
  }, [resetState, startCountdown]);

  const stopRecording = useCallback(() => {
    stopRecognition();
    setState((prev) => ({ ...prev, isRecording: false }));
  }, []);

  const cancelCommit = useCallback(() => {
    clearCountdown();
    resetState();
  }, [clearCountdown, resetState]);

  const confirmImmediately = useCallback(async () => {
    clearCountdown();
    await executeCommit(parsedResultRef.current, transcriptRef.current);
  }, [clearCountdown, executeCommit]);

  const editParsedResult = useCallback(
    (updated: Partial<ParseResult>) => {
      if (!parsedResultRef.current) return;
      clearCountdown();
      const merged = { ...parsedResultRef.current, ...updated } as ParseResult;
      parsedResultRef.current = merged;
      setState((prev) => ({
        ...prev,
        parsedResult: merged,
        countdown: 0,
      }));
    },
    [clearCountdown]
  );

  const submitText = useCallback(async (text: string) => {
    // Rapid-fire debounce: commit pending transaction first
    if (parsedResultRef.current && countdownRef.current) {
      clearCountdown();
      await executeCommit(parsedResultRef.current, transcriptRef.current);
    }

    resetState();
    const trip = tripRef.current;
    const memberNames = trip?.members.map((m) => m.name) ?? [];

    const parsed = parseVoiceInput(text, {
      memberNames,
      leaderId: trip?.members[0]?.id ?? null,
      currentUserId: trip?.members[0]?.id ?? '__SELF__',
    });

    if (parsed.type === 'query' || parsed.type === 'command') {
      await audioParseSuccess();
      setState((prev) => ({
        ...prev,
        isRecording: false,
        rawTranscript: text,
        parsedResult: parsed,
        stage: 'parsed',
        countdown: 0,
      }));
      return;
    }

    startCountdown(parsed, text);
  }, [resetState, startCountdown, clearCountdown, executeCommit]);

  return {
    state,
    startRecording,
    stopRecording,
    cancelCommit,
    confirmImmediately,
    editParsedResult,
    submitText,
  };
}
