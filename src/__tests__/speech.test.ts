/**
 * speech.test.ts — Speech Synthesis (Campfire Readout) tests
 * Validates generated speech script text matches the exact settlement
 * matrix and pool balance, and that TTS functions call expo-speech correctly.
 */

import {
  speakSettlementSummary,
  speakPoolStatus,
  stopSpeaking,
} from '../lib/speechSynthesis';
import * as Speech from 'expo-speech';

jest.mock('expo-speech');

const mockSpeech = Speech as unknown as { speak: jest.Mock; stop: jest.Mock; isSpeakingAsync: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  mockSpeech.isSpeakingAsync.mockResolvedValue(false);
});

describe('speakSettlementSummary', () => {
  const memberMap = new Map([
    ['a', 'Amit'],
    ['r', 'Rahul'],
    ['s', 'Sara'],
  ]);

  it('formats full settlement with pool balance', async () => {
    const settlements = [
      { from: 'a', to: 'r', amount: 650 },
      { from: 's', to: 'r', amount: 420 },
    ];

    await speakSettlementSummary('Goa Trek', 18400, settlements, memberMap, 3450);

    expect(mockSpeech.speak).toHaveBeenCalledTimes(1);
    const spoken = mockSpeech.speak.mock.calls[0][0] as string;

    expect(spoken).toContain('Trip: Goa Trek');
    expect(spoken).toContain('Total spent: 18,400.00 rupees');
    expect(spoken).toContain('Pool remaining: 3,450.00 rupees');
    expect(spoken).toContain('Amit pays Rahul 650.00 rupees');
    expect(spoken).toContain('Sara pays Rahul 420.00 rupees');
    expect(spoken).toContain('All other debts cleared');
  });

  it('formats settlement without pool balance', async () => {
    const settlements = [{ from: 'a', to: 'r', amount: 650 }];

    await speakSettlementSummary('Ladakh Trip', 12000, settlements, memberMap);

    const spoken = mockSpeech.speak.mock.calls[0][0] as string;
    expect(spoken).toContain('Trip: Ladakh Trip');
    expect(spoken).toContain('Total spent: 12,000.00 rupees');
    expect(spoken).not.toContain('Pool remaining');
    expect(spoken).toContain('Amit pays Rahul 650.00 rupees');
  });

  it('handles empty settlements (all settled)', async () => {
    await speakSettlementSummary('Goa Trek', 10000, [], memberMap);

    const spoken = mockSpeech.speak.mock.calls[0][0] as string;
    expect(spoken).toContain('All balances are fully settled');
    expect(spoken).toContain('Nobody owes anything');
  });

  it('handles negative pool balance (deficit)', async () => {
    const settlements = [{ from: 'a', to: 'r', amount: 100 }];

    await speakSettlementSummary('Trek', 5000, settlements, memberMap, -500);

    const spoken = mockSpeech.speak.mock.calls[0][0] as string;
    expect(spoken).toContain('Pool deficit: 500.00 rupees');
  });

  it('uses default readout options (rate 0.95, en-IN)', async () => {
    await speakSettlementSummary('Test', 100, [], memberMap);

    const opts = mockSpeech.speak.mock.calls[0][1];
    expect(opts).toMatchObject({
      language: 'en-IN',
      rate: 0.95,
      pitch: 1.0,
    });
  });

  it('allows custom readout options override', async () => {
    await speakSettlementSummary('Test', 100, [], memberMap, undefined, {
      rate: 1.2,
      pitch: 0.8,
    });

    const opts = mockSpeech.speak.mock.calls[0][1];
    expect(opts).toMatchObject({
      rate: 1.2,
      pitch: 0.8,
    });
  });

  it('stops any ongoing speech before starting new readout', async () => {
    mockSpeech.isSpeakingAsync.mockResolvedValue(true);

    await speakSettlementSummary('Test', 100, [], memberMap);

    expect(mockSpeech.stop).toHaveBeenCalled();
    expect(mockSpeech.speak).toHaveBeenCalledTimes(1);
  });

  it('formats large amounts with comma separators', async () => {
    await speakSettlementSummary('Big Trip', 999999, [], memberMap);

    const spoken = mockSpeech.speak.mock.calls[0][0] as string;
    expect(spoken).toContain('9,99,999.00');
  });
});

describe('speakPoolStatus', () => {
  it('speaks positive balance with burn percent', async () => {
    await speakPoolStatus(3450, 40);

    expect(mockSpeech.speak).toHaveBeenCalledTimes(1);
    const spoken = mockSpeech.speak.mock.calls[0][0] as string;

    expect(spoken).toContain('Pool balance: 3,450.00 rupees remaining');
    expect(spoken).toContain('40 percent spent');
  });

  it('speaks negative balance as deficit', async () => {
    await speakPoolStatus(-500, 120);

    const spoken = mockSpeech.speak.mock.calls[0][0] as string;
    expect(spoken).toContain('Pool deficit: 500.00 rupees');
    expect(spoken).toContain('Pool is overdrawn');
  });

  it('speaks zero balance', async () => {
    await speakPoolStatus(0, 100);

    const spoken = mockSpeech.speak.mock.calls[0][0] as string;
    expect(spoken).toContain('Pool balance: 0.00 rupees remaining');
  });
});

describe('stopSpeaking', () => {
  it('calls Speech.stop()', () => {
    stopSpeaking();
    expect(mockSpeech.stop).toHaveBeenCalled();
  });
});
