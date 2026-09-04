import { renderHook, act } from '@testing-library/react-hooks';
import { useVoiceExpense } from '../hooks/useVoiceExpense';
import * as offlineSpeech from '../lib/offlineSpeech';
import * as database from '../lib/database';
import * as audioFeedback from '../lib/audioFeedback';
import type { Trip } from '../types';

jest.mock('../lib/offlineSpeech', () => ({
  startOfflineRecognition: jest.fn(),
  stopRecognition: jest.fn(),
}));

jest.mock('../lib/database', () => ({
  addExpense: jest.fn(),
  addPersonalExpense: jest.fn(),
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
const mockAddPersonalExpense = database.addPersonalExpense as jest.Mock;
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

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('auto-commit', () => {
  it('commits trip expense after 2-second countdown', async () => {
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

    expect(result.current.state.stage).toBe('parsed');
    expect(result.current.state.countdown).toBeGreaterThan(0);

    await act(async () => {
      jest.advanceTimersByTime(2100);
    });

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

    await act(async () => {
      result.current.cancelCommit();
    });

    expect(result.current.state.stage).toBe('idle');
    expect(result.current.state.countdown).toBe(0);

    await act(async () => {
      jest.advanceTimersByTime(3000);
    });

    expect(mockAddExpense).not.toHaveBeenCalled();
  });

  it('commits immediately when confirmImmediately is called', async () => {
    mockStartRecognition.mockResolvedValue({
      transcript: 'petrol 850 split with Rahul',
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

  it('saves personal expense without requiring a trip', async () => {
    mockStartRecognition.mockResolvedValue({
      transcript: 'chai 30 personal',
      confidence: 0.88,
    });

    const { result } = renderHook(() =>
      useVoiceExpense(null, jest.fn())
    );

    await act(async () => {
      await result.current.startRecording();
    });

    await act(async () => {
      jest.advanceTimersByTime(2100);
    });

    expect(mockAddPersonalExpense).toHaveBeenCalledTimes(1);
    expect(mockAddExpense).not.toHaveBeenCalled();
    expect(result.current.state.stage).toBe('idle');
  });
});

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
