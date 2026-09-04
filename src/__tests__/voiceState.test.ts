// ─────────────────────────────────────────────────────────────────
// voiceState.test.ts — Tests for useVoiceExpense hook
// Verifies timer cancellation, immediate commit, and DB writes.
// ─────────────────────────────────────────────────────────────────

import { renderHook, act } from '@testing-library/react-hooks';
import { useVoiceExpense } from '../hooks/useVoiceExpense';
import * as offlineSpeech from '../lib/offlineSpeech';
import * as database from '../lib/database';
import * as audioFeedback from '../lib/audioFeedback';
import type { Trip } from '../types';

// ── Mocks ──────────────────────────────────────────────────────────

jest.mock('../lib/offlineSpeech', () => ({
  startOfflineRecognition: jest.fn(),
  stopRecognition: jest.fn(),
}));

jest.mock('../lib/database', () => ({
  addExpense: jest.fn(),
  addPoolDeposit: jest.fn(),
  appendLedgerEvent: jest.fn(),
}));

jest.mock('../lib/audioFeedback', () => ({
  audioParseSuccess: jest.fn(),
  audioParseError: jest.fn(),
}));

jest.mock('../lib/debt', () => ({
  computeEqualSplit: jest.fn((_amount: number, memberIds: string[]) =>
    memberIds.map((id) => ({ memberId: id, amount: _amount / memberIds.length }))
  ),
}));

jest.mock('../lib/uuid', () => ({
  generateUUID: jest.fn(() => 'test-uuid'),
}));

const mockStartRecognition = offlineSpeech.startOfflineRecognition as jest.Mock;
const mockAddExpense = database.addExpense as jest.Mock;
const mockAddPoolDeposit = database.addPoolDeposit as jest.Mock;
const mockAudioSuccess = audioFeedback.audioParseSuccess as jest.Mock;
const mockAudioError = audioFeedback.audioParseError as jest.Mock;

const mockTrip: Trip = {
  id: 'trip-1',
  name: 'Test Trip',
  currency: 'INR',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  members: [
    { id: 'member-1', name: 'You' },
    { id: 'member-2', name: 'Rahul' },
    { id: 'member-3', name: 'Amit' },
  ],
  expenses: [],
};

// ── Tests ──────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('auto-commit', () => {
  it('commits expense after 2-second countdown', async () => {
    mockStartRecognition.mockResolvedValue({
      transcript: 'dinner 1200 split with all',
      confidence: 0.9,
    });

    const { result } = renderHook(() =>
      useVoiceExpense(mockTrip, jest.fn())
    );

    await act(async () => {
      await result.current.startRecording();
    });

    // Should be in parsed state
    expect(result.current.state.stage).toBe('parsed');
    expect(result.current.state.countdown).toBeGreaterThan(0);

    // Advance timer past 2 seconds
    await act(async () => {
      jest.advanceTimersByTime(2100);
    });

    // Should have committed
    expect(mockAddExpense).toHaveBeenCalledTimes(1);
    expect(mockAudioSuccess).toHaveBeenCalled();
    expect(result.current.state.stage).toBe('idle');
  });

  it('cancels commit when cancelCommit is called', async () => {
    mockStartRecognition.mockResolvedValue({
      transcript: 'chai 60',
      confidence: 0.85,
    });

    const { result } = renderHook(() =>
      useVoiceExpense(mockTrip, jest.fn())
    );

    await act(async () => {
      await result.current.startRecording();
    });

    // Cancel before countdown finishes
    await act(async () => {
      result.current.cancelCommit();
    });

    expect(result.current.state.stage).toBe('idle');
    expect(result.current.state.countdown).toBe(0);

    // Advance timer — should NOT commit
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });

    expect(mockAddExpense).not.toHaveBeenCalled();
  });

  it('commits immediately when confirmImmediately is called', async () => {
    mockStartRecognition.mockResolvedValue({
      transcript: 'petrol 850',
      confidence: 0.91,
    });

    const { result } = renderHook(() =>
      useVoiceExpense(mockTrip, jest.fn())
    );

    await act(async () => {
      await result.current.startRecording();
    });

    await act(async () => {
      await result.current.confirmImmediately();
    });

    expect(mockAddExpense).toHaveBeenCalledTimes(1);
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
    expect(mockAudioError).toHaveBeenCalled();
  });
});
