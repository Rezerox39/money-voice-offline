import { useState, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { parseVoiceInput, formatParsedExpense, formatParsedQuery, formatParsedCommand } from '../lib/voiceParser';
import {
  audioParseSuccess,
  audioParseError,
  speakSettlement,
  speakConfirm,
  stopSpeaking,
} from '../lib/audioFeedback';
import { VoiceEngineState, VoicePendingEntry, Trip, SplitShare } from '../types';
import { addExpense } from '../lib/database';
import { computeEqualSplit, simplifyDebts } from '../lib/debt';

interface UseVoiceEngineOptions {
  activeTrip: Trip | null;
  onNavigate?: (route: string) => void;
  onRefresh?: () => void;
}

interface UseVoiceEngineReturn {
  state: VoiceEngineState;
  pendingEntry: VoicePendingEntry | null;
  displayText: string;
  error: string | null;
  startListening: () => Promise<void>;
  stopListening: () => void;
  confirmPending: () => Promise<void>;
  cancelPending: () => void;
  editPending: () => void;
}

export function useVoiceEngine({
  activeTrip,
  onNavigate,
  onRefresh,
}: UseVoiceEngineOptions): UseVoiceEngineReturn {
  const [state, setState] = useState<VoiceEngineState>('idle');
  const [pendingEntry, setPendingEntry] = useState<VoicePendingEntry | null>(null);
  const [displayText, setDisplayText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const memberNames = activeTrip?.members.map((m) => m.name) ?? [];

  const startListening = useCallback(async () => {
    setError(null);
    stopSpeaking();

    const SpeechRecognition =
      (globalThis as any).SpeechRecognition ||
      (globalThis as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setState('processing');
      setError('Speech recognition not available. Use manual input.');
      setState('idle');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-IN';
      recognition.maxAlternatives = 1;

      recognitionRef.current = recognition;
      setState('listening');

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        processTranscript(transcript);
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech') {
          setError('No speech detected. Try again.');
        } else {
          setError(`Recognition error: ${event.error}`);
        }
        audioParseError();
        setState('idle');
      };

      recognition.onend = () => {
        if (stateRef.current === 'listening') {
          setState('idle');
        }
      };

      recognition.start();
    } catch {
      setError('Could not start speech recognition.');
      setState('idle');
    }
  }, [activeTrip]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setState('idle');
  }, []);

  const processTranscript = useCallback(
    async (transcript: string) => {
      setState('processing');

      try {
        const parsed = parseVoiceInput(transcript, memberNames);

        if (parsed.type === 'command') {
          const display = formatParsedCommand(parsed);
          setDisplayText(display);

          switch (parsed.command) {
            case 'undo':
              setError('Undo not yet implemented');
              break;
            case 'showQR':
              onNavigate?.('/trips/qr');
              break;
            case 'shareWhatsApp':
              onNavigate?.('/settle');
              break;
            case 'readSettlement':
              if (activeTrip) {
                const settlements = simplifyDebts(activeTrip.members, activeTrip.expenses);
                const text = settlements
                  .map((s) => {
                    const from = activeTrip.members.find((m) => m.id === s.from)?.name ?? 'Unknown';
                    const to = activeTrip.members.find((m) => m.id === s.to)?.name ?? 'Unknown';
                    return `${from} pays ${to} ${s.amount}`;
                  })
                  .join('. ');
                await speakSettlement(
                  `Total trip expense: ${activeTrip.expenses.reduce((s, e) => s + e.amount, 0)}. ${text}. All debts cleared.`
                );
              }
              break;
            case 'help':
              setDisplayText(
                'COMMANDS: "undo last" | "switch to [trip]" | "show QR" | ' +
                '"share on WhatsApp" | "read settlement" | "who owes what"'
              );
              break;
            case 'cancel':
              break;
            case 'switchTrip':
              if (parsed.tripName) {
                onNavigate?.(`/?switch=${encodeURIComponent(parsed.tripName)}`);
              }
              break;
          }

          await audioParseSuccess();
          setState('idle');
          return;
        }

        if (parsed.type === 'query') {
          const display = formatParsedQuery(parsed);
          setDisplayText(display);

          switch (parsed.query) {
            case 'settle':
            case 'whoOwesWhat':
              onNavigate?.('/settle');
              break;
            case 'totalToday':
            case 'totalAll':
              if (activeTrip) {
                const total = activeTrip.expenses.reduce((s, e) => s + e.amount, 0);
                setDisplayText(`${display}: ₹${total.toLocaleString('en-IN')}`);
              }
              break;
            case 'howMuchPaid':
              if (activeTrip && parsed.memberName) {
                const member = activeTrip.members.find(
                  (m) => m.name.toLowerCase().startsWith(parsed.memberName!.toLowerCase())
                );
                if (member) {
                  const paid = activeTrip.expenses
                    .filter((e) => e.paidBy === member.id)
                    .reduce((s, e) => s + e.amount, 0);
                  setDisplayText(`${member.name} paid: ₹${paid.toLocaleString('en-IN')}`);
                }
              }
              break;
            case 'recentExpenses':
              if (activeTrip && activeTrip.expenses.length > 0) {
                const recent = activeTrip.expenses.slice(0, 5);
                const list = recent.map((e) => `₹${e.amount} ${e.title}`).join(', ');
                setDisplayText(`RECENT: ${list}`);
              }
              break;
          }

          await audioParseSuccess();
          setState('idle');
          return;
        }

        // Expense → safety window
        const display = formatParsedExpense(parsed, memberNames);
        setDisplayText(display);
        setPendingEntry({
          rawTranscript: transcript,
          parsedDisplay: display,
          timestamp: Date.now(),
          tripId: activeTrip?.id,
        });

        await audioParseSuccess();
        setState('confirming');
      } catch {
        setError('Could not parse voice input.');
        await audioParseError();
        setState('idle');
      }
    },
    [activeTrip, memberNames, onNavigate]
  );

  const confirmPending = useCallback(async () => {
    if (!pendingEntry) return;
    setState('writing');

    try {
      const parsed = parseVoiceInput(pendingEntry.rawTranscript, memberNames);

      if (parsed.type === 'expense' && activeTrip) {
        let splits: SplitShare[];

        if (parsed.splitMode === 'none' || parsed.isPersonal) {
          splits = [{ memberId: '__SELF__', amount: parsed.amount }];
        } else if (parsed.splitMode === 'exact') {
          splits = Object.entries(parsed.exactSplits).map(([name, amount]) => {
            const member = activeTrip.members.find(
              (m) => m.name.toLowerCase().startsWith(name.toLowerCase())
            );
            return { memberId: member?.id ?? name, amount };
          });
        } else {
          const targetMembers =
            parsed.splitMembers.length > 0
              ? parsed.splitMembers
              : activeTrip.members.map((m) => m.id);

          const validMemberIds = targetMembers.filter(
            (id) => id !== '__SELF__' && activeTrip.members.some((m) => m.id === id)
          );

          if (validMemberIds.length === 0) {
            splits = computeEqualSplit(parsed.amount, activeTrip.members.map((m) => m.id));
          } else {
            splits = computeEqualSplit(parsed.amount, validMemberIds);
          }
        }

        let payerId: string;
        if (!parsed.payer || parsed.payer === '__SELF__') {
          payerId = '__SELF__';
        } else {
          const member = activeTrip.members.find(
            (m) => m.name.toLowerCase().startsWith(parsed.payer!.toLowerCase())
          );
          payerId = member?.id ?? '__SELF__';
        }

        await addExpense(
          activeTrip.id,
          parsed.title,
          parsed.amount,
          payerId,
          splits.filter((s) => s.memberId !== '__SELF__'),
          parsed.category
        );

        await speakConfirm(`${parsed.title} of ${parsed.amount} rupees logged`);
        onRefresh?.();
      }
    } catch {
      setError('Failed to save entry.');
      await audioParseError();
    } finally {
      setPendingEntry(null);
      setDisplayText('');
      setState('idle');
    }
  }, [pendingEntry, activeTrip, memberNames, onRefresh]);

  const cancelPending = useCallback(() => {
    setPendingEntry(null);
    setDisplayText('');
    setState('idle');
  }, []);

  const editPending = useCallback(() => {
    setState('idle');
    setPendingEntry(null);
  }, []);

  return {
    state,
    pendingEntry,
    displayText,
    error,
    startListening,
    stopListening,
    confirmPending,
    cancelPending,
    editPending,
  };
}
