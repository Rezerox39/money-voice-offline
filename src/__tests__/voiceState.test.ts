/**
 * voiceState.test.ts — Tests for useVoiceExpense hook state transitions.
 *
 * Covers:
 *  - Timer cancellation when cancelCommit() is called
 *  - Immediate execution when confirmImmediately() is called
 *  - Database write triggered automatically when countdown finishes
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { useVoiceExpense } from '../hooks/useVoiceExpense';
import { addExpense, addPoolDeposit } from '../lib/database';
import { startOfflineRecognition } from '../lib/offlineSpeech';
import { audioParseSuccess, audioParseError } from '../lib/audioFeedback';
import type { Trip } from '../types';

// ── Mock Setup ─────────────────────────────────────────────────────

jest.mock('../lib/database');
jest.mock('../lib/offlineSpeech');
jest.mock('../lib/audioFeedback');

const mockTrip: Trip = {
  id: 'trip-1',
  name: 'Goa Trip',
  currency: 'INR',
  members: [
    { id: 'member-1', name: 'Alice' },
    { id: 'member-2', name: 'Bob' },
  ],
  expenses: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const mockAddExpense = addExpense as jest.MockedFunction<typeof addExpense>;
const mockAddPoolDeposit = addPoolDeposit as jest.MockedFunction<typeof addPoolDeposit>;
const mockStartRecognition = startOfflineRecognition as jest.MockedFunction<typeof startOfflineRecognition>;
const mockAudioSuccess = audioParseSuccess as jest.MockedFunction<typeof audioParseSuccess>;
const mockAudioError = audioParseError as jest.MockedFunction<typeof audioParseError>;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockAddExpense.mockResolvedValue({ id: 'exp-1', tripId: 'trip-1', title: '', amount: 0, paidBy: '', splitBetween: [], category: '', updatedAt: 0 });
  mockAddPoolDeposit.mockResolvedValue({ id: 'dep-1', tripId: 'trip-1', memberId: '', amount: 0, createdAt: 0 });
  mockAudioSuccess.mockResolvedValue(undefined);
  mockAudioError.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

// ── Test: Timer cancellation ───────────────────────────────────────

describe('cancelCommit()', () => {
  it('clears the countdown timer and resets state', async () => {
    // Set up recognition to return an expense utterance
    mockStartRecognition.mockResolvedValue({ transcript: 'chai 30', confidence: 0.95 });

    const { result } = renderHook(() =>
      useVoiceExpense(mockTrip, jest.fn())
    );

    // Start listening — this should trigger parsing and start countdown
    await act(async () => {
      await result.current.startRecording();
    });

    // Should be in parsed state with countdown > 0
    expect(result.current.state.stage).toBe('parsed');
    expect(result.current.state.countdown).toBeGreaterThan(0);
    expect(result.current.state.parsedResult).not.toBeNull();

    // Cancel the commit
    act(() => {
      result.current.cancelCommit();
    });

    // State should be reset
    expect(result.current.state.stage).toBe('idle');
    expect(result.current.state.countdown).toBe(0);
    expect(result.current.state.parsedResult).toBeNull();

    // Advance timers — no database write should happen
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(mockAddExpense).not.toHaveBeenCalled();
  });
});

// ── Test: Immediate confirmation ───────────────────────────────────

describe('confirmImmediately()', () => {
  it('writes to database immediately without waiting for countdown', async () => {
    mockStartRecognition.mockResolvedValue({ transcript: 'chai 30', confidence: 0.95 });

    const { result } = renderHook(() =>
      useVoiceExpense(mockTrip, jest.fn())
    );

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.state.stage).toBe('parsed');

    // Confirm immediately
    await act(async () => {
      await result.current.confirmImmediately();
    });

    // Database write should have been called
    expect(mockAddExpense).toHaveBeenCalledTimes(1);
    expect(mockAddExpense).toHaveBeenCalledWith(
      'trip-1',
      expect.any(String), // title
      30,                 // amount
      expect.any(String), // payerId
      expect.any(Array),  // splits
      expect.any(String)  // category
    );
    expect(mockAudioSuccess).toHaveBeenCalled();

    // State should be idle after commit
    expect(result.current.state.stage).toBe('idle');
  });
});

// ── Test: Automatic commit after countdown ─────────────────────────

describe('auto-commit', () => {
  it('writes to database when countdown reaches zero', async () => {
    mockStartRecognition.mockResolvedValue({ transcript: 'petrol 500', confidence: 0.9 });

    const onCommitSuccess = jest.fn();
    const { result } = renderHook(() =>
      useVoiceExpense(mockTrip, onCommitSuccess)
    );

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.state.stage).toBe('parsed');
    expect(result.current.state.countdown).toBeGreaterThan(0);

    // Advance timer past the 2-second countdown
    await act(async () => {
      jest.advanceTimersByTime(2100);
    });

    // Database write should have been triggered
    expect(mockAddExpense).toHaveBeenCalledTimes(1);
    expect(mockAddPoolDeposit).not.toHaveBeenCalled();
    expect(onCommitSuccess).toHaveBeenCalled();
    expect(result.current.state.stage).toBe('idle');
  });

  it('handles pool deposit intent correctly', async () => {
    mockStartRecognition.mockResolvedValue({ transcript: 'add 1500 to pool', confidence: 0.92 });

    const { result } = renderHook(() =>
      useVoiceExpense(mockTrip, jest.fn())
    );

    await act(async () => {
      await result.current.startRecording();
    });

    // Advance timer
    await act(async () => {
      jest.advanceTimersByTime(2100);
    });

    expect(mockAddPoolDeposit).toHaveBeenCalledTimes(1);
    expect(mockAddPoolDeposit).toHaveBeenCalledWith(
      'trip-1',
      expect.any(String),
      1500
    );
    expect(mockAddExpense).not.toHaveBeenCalled();
  });
});

// ── Test: Error handling ───────────────────────────────────────────

describe('error handling', () => {
  it('surfaces offline model missing error', async () => {
    mockStartRecognition.mockRejectedValue({
      code: 'service-not-allowed',
      message: 'Offline speech model required.',
      isOfflineModelMissing: true,
    });

    const { result } = renderHook(() =>
      useVoiceExpense(mockTrip, jest.fn())
    );

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.state.stage).toBe('error');
    expect(result.current.state.error).toContain('Offline speech model');
    expect(mockAudioError).toHaveBeenCalled();
  });

  it('surfaces no-speech error', async () => {
    mockStartRecognition.mockRejectedValue({
      code: 'no-speech',
      message: 'No speech detected.',
      isOfflineModelMissing: false,
    });

    const { result } = renderHook(() =>
      useVoiceExpense(mockTrip, jest.fn())
    );

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.state.stage).toBe('error');
    expect(result.current.state.error).toContain('No speech detected');
  });
});

// ── Test: Query intents skip countdown ──────────────────────────────

describe('query intents', () => {
  it('does not start countdown for query commands', async () => {
    mockStartRecognition.mockResolvedValue({ transcript: 'who owes what', confidence: 0.95 });

    const { result } = renderHook(() =>
      useVoiceExpense(mockTrip, jest.fn())
    );

    await act(async () => {
      await result.current.startRecording();
    });

    // Should be parsed but NOT counting down
    expect(result.current.state.stage).toBe('parsed');
    expect(result.current.state.countdown).toBe(0);
    expect(result.current.state.parsedResult?.type).toBe('query');

    // No database write
    expect(mockAddExpense).not.toHaveBeenCalled();
  });
});

// ── Test: editParsedResult ─────────────────────────────────────────

describe('editParsedResult()', () => {
  it('pauses timer and allows editing the parsed result', async () => {
    mockStartRecognition.mockResolvedValue({ transcript: 'chai 30', confidence: 0.95 });

    const { result } = renderHook(() =>
      useVoiceExpense(mockTrip, jest.fn())
    );

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.state.stage).toBe('parsed');
    const originalCountdown = result.current.state.countdown;

    // Edit the result — should pause countdown
    act(() => {
      result.current.editParsedResult({ title: 'Coffee' } as any);
    });

    expect(result.current.state.countdown).toBe(0);
    expect(result.current.state.parsedResult).toMatchObject({ title: 'Coffee' });

    // Advance timer — no auto-commit should happen
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(mockAddExpense).not.toHaveBeenCalled();
  });
});
