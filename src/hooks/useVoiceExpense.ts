import { useState, useCallback, useRef, useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { startOfflineRecognition, stopRecognition } from '../lib/offlineSpeech';
import { parseVoiceInput, type ParseResult } from '../lib/voiceParser';
import { addExpense, addPersonalExpense, addPoolDeposit, appendLedgerEvent } from '../lib/database';
import { computeEqualSplit } from '../lib/debt';
import { audioParseSuccess, audioParseError } from '../lib/audioFeedback';
import type { Trip } from '../types';
import { generateUUID } from '../lib/uuid';

export interface VoiceState {
  isRecording: boolean;
  rawTranscript: string;
  parsedResult: ParseResult | null;
  countdown: number;
  error: string | null;
  stage: 'idle' | 'listening' | 'parsed' | 'committing' | 'error';
}

export type { ParseResult };

const COUNTDOWN_DURATION = 2.0;
const COUNTDOWN_TICK_MS = 100;

export function useVoiceExpense(currentTrip: Trip | null, onCommitSuccess: () => void) {
  const [state, setState] = useState<VoiceState>({
    isRecording: false, rawTranscript: '', parsedResult: null,
    countdown: 0, error: null, stage: 'idle',
  });

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const parsedResultRef = useRef<ParseResult | null>(null);
  const transcriptRef = useRef('');
  const tripRef = useRef(currentTrip);
  tripRef.current = currentTrip;

  useEffect(() => {
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background' || next === 'inactive') {
        stopRecognition();
        if (countdownRef.current) {
          clearCountdown();
          parsedResultRef.current = null;
          transcriptRef.current = '';
          setState((p) => ({ ...p, isRecording: false, stage: 'idle', countdown: 0 }));
        }
      }
    });
    return () => sub?.remove();
  }, []);

  const clearCountdown = useCallback(() => {
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  }, []);

  const startCountdown = useCallback((result: ParseResult, transcript: string) => {
    clearCountdown();
    parsedResultRef.current = result;
    transcriptRef.current = transcript;
    setState((p) => ({ ...p, stage: 'parsed', parsedResult: result, rawTranscript: transcript, countdown: COUNTDOWN_DURATION, error: null }));
    let remaining = COUNTDOWN_DURATION;
    countdownRef.current = setInterval(() => {
      remaining -= COUNTDOWN_TICK_MS / 1000;
      if (remaining <= 0) { clearCountdown(); executeCommit(parsedResultRef.current, transcriptRef.current); return; }
      setState((p) => ({ ...p, countdown: Math.round(remaining * 10) / 10 }));
    }, COUNTDOWN_TICK_MS);
  }, [clearCountdown]);

  const executeCommit = useCallback(async (result: ParseResult | null, transcript: string) => {
    if (!result) return;
    setState((p) => ({ ...p, stage: 'committing' }));

    try {
      if (result.type === 'expense') {
        // ── PERSONAL EXPENSE: save directly, no trip needed ──
        if (result.isPersonal) {
          await addPersonalExpense(result.title, result.amount, result.category || 'Other');
          await audioParseSuccess();
          onCommitSuccess();
          resetState();
          return;
        }

        // ── TRIP EXPENSE: requires active trip ──
        const trip = tripRef.current;
        if (!trip) {
          setState((p) => ({ ...p, stage: 'error', error: 'No active trip. Switch to /PERSONAL or select a trip.', countdown: 0 }));
          return;
        }

        let payerId: string;
        if (!result.payer || result.payer.toLowerCase() === 'me' || result.payer.toLowerCase() === 'i') {
          payerId = trip.members[0]?.id ?? '__SELF__';
        } else {
          const member = trip.members.find((m) => m.name.toLowerCase().startsWith(result.payer!.toLowerCase()));
          payerId = member?.id ?? trip.members[0]?.id ?? '__SELF__';
        }

        let splitBetween: { memberId: string; amount: number }[];
        if (result.splitMode === 'exact' && Object.keys(result.exactSplits).length > 0) {
          splitBetween = Object.entries(result.exactSplits).map(([name, amount]) => {
            const member = trip.members.find((m) => m.name.toLowerCase().startsWith(name.toLowerCase()));
            return { memberId: member?.id ?? name, amount };
          });
        } else if (result.splitMembers.length > 0) {
          const memberIds = result.splitMembers.map((n) => trip.members.find((m) => m.name.toLowerCase().startsWith(n.toLowerCase()))?.id).filter((id): id is string => !!id);
          splitBetween = computeEqualSplit(result.amount, memberIds.length > 0 ? memberIds : [payerId]);
        } else {
          splitBetween = computeEqualSplit(result.amount, trip.members.map((m) => m.id));
        }

        await addExpense(trip.id, result.title, result.amount, payerId, splitBetween, result.category || 'Other');
        await appendLedgerEvent(trip.id, 'expense', generateUUID(), 'add', { title: result.title, amount: result.amount, paidBy: payerId, category: result.category, splitBetween });
      } else if (result.type === 'pool' && result.intent === 'POOL_DEPOSIT') {
        const trip = tripRef.current;
        if (!trip) {
          setState((p) => ({ ...p, stage: 'error', error: 'No active trip for pool deposit.', countdown: 0 }));
          return;
        }
        const payerId = result.payerId || trip.members[0]?.id || '__SELF__';
        await addPoolDeposit(trip.id, payerId, result.amount);
        await appendLedgerEvent(trip.id, 'pool_deposit', generateUUID(), 'add', { amount: result.amount, payerId });
      }
      await audioParseSuccess();
      onCommitSuccess();
      resetState();
    } catch (err: any) {
      await audioParseError();
      setState((p) => ({ ...p, stage: 'error', error: `Write failed: ${err?.message ?? 'unknown'}`, countdown: 0 }));
    }
  }, [onCommitSuccess]);

  const resetState = useCallback(() => {
    clearCountdown();
    parsedResultRef.current = null;
    transcriptRef.current = '';
    setState({ isRecording: false, rawTranscript: '', parsedResult: null, countdown: 0, error: null, stage: 'idle' });
  }, [clearCountdown]);

  const startRecording = useCallback(async () => {
    if (parsedResultRef.current && countdownRef.current) { clearCountdown(); await executeCommit(parsedResultRef.current, transcriptRef.current); }
    resetState();
    setState((p) => ({ ...p, isRecording: true, stage: 'listening' }));
    try {
      const result = await startOfflineRecognition();
      const trip = tripRef.current;
      const memberNames = trip?.members.map((m) => m.name) ?? [];
      const parsed = parseVoiceInput(result.transcript, { memberNames, leaderId: trip?.members[0]?.id ?? null, currentUserId: trip?.members[0]?.id ?? '__SELF__' });
      if (parsed.type === 'query' || parsed.type === 'command') {
        await audioParseSuccess();
        setState((p) => ({ ...p, isRecording: false, rawTranscript: result.transcript, parsedResult: parsed, stage: 'parsed', countdown: 0 }));
        return;
      }
      setState((p) => ({ ...p, isRecording: false }));
      startCountdown(parsed, result.transcript);
    } catch (err: any) {
      await audioParseError();
      setState((p) => ({ ...p, isRecording: false, stage: 'error', error: err?.message || 'Recognition failed.', countdown: 0 }));
    }
  }, [resetState, startCountdown, executeCommit]);

  const stopRecording = useCallback(() => { stopRecognition(); setState((p) => ({ ...p, isRecording: false })); }, []);
  const cancelCommit = useCallback(() => { clearCountdown(); resetState(); }, [clearCountdown, resetState]);
  const confirmImmediately = useCallback(async () => { clearCountdown(); await executeCommit(parsedResultRef.current, transcriptRef.current); }, [clearCountdown, executeCommit]);
  const editParsedResult = useCallback((updated: Partial<ParseResult>) => {
    if (!parsedResultRef.current) return;
    clearCountdown();
    parsedResultRef.current = { ...parsedResultRef.current, ...updated } as ParseResult;
    setState((p) => ({ ...p, parsedResult: parsedResultRef.current, countdown: 0 }));
  }, [clearCountdown]);

  const submitText = useCallback(async (text: string) => {
    if (parsedResultRef.current && countdownRef.current) { clearCountdown(); await executeCommit(parsedResultRef.current, transcriptRef.current); }
    resetState();
    const trip = tripRef.current;
    const memberNames = trip?.members.map((m) => m.name) ?? [];
    const parsed = parseVoiceInput(text, { memberNames, leaderId: trip?.members[0]?.id ?? null, currentUserId: trip?.members[0]?.id ?? '__SELF__' });
    if (parsed.type === 'query' || parsed.type === 'command') {
      await audioParseSuccess();
      setState((p) => ({ ...p, isRecording: false, rawTranscript: text, parsedResult: parsed, stage: 'parsed', countdown: 0 }));
      return;
    }
    startCountdown(parsed, text);
  }, [resetState, startCountdown, clearCountdown, executeCommit]);

  return { state, startRecording, stopRecording, cancelCommit, confirmImmediately, editParsedResult, submitText };
}
