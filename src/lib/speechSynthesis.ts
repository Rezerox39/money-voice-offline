// ─────────────────────────────────────────────────────────────────
// speechSynthesis.ts — Offline campfire readout engine
// Uses expo-speech (Android native offline TTS) for utilitarian
// audio feedback around the campfire, no internet required.
// ─────────────────────────────────────────────────────────────────

import * as Speech from 'expo-speech';
import { SettlementTransaction } from '../types';

// ── Types ──────────────────────────────────────────────────────────

export interface ReadoutOptions {
  rate?: number;
  pitch?: number;
  language?: string;
}

// ── Defaults ───────────────────────────────────────────────────────

const DEFAULT_OPTIONS: Required<ReadoutOptions> = {
  rate: 0.95,
  pitch: 1.0,
  language: 'en-IN',
};

// ── Internal Helpers ───────────────────────────────────────────────

async function speak(text: string, options?: ReadoutOptions): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  try {
    const isSpeaking = await Speech.isSpeakingAsync();
    if (isSpeaking) await Speech.stop();
    await Speech.speak(text, {
      language: opts.language,
      rate: opts.rate,
      pitch: opts.pitch,
    });
  } catch {
    // TTS engine unavailable — fail silently in offline mode
  }
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Campfire readout: speak the full settlement summary aloud.
 *
 * Produces a utilitarian, robotic cadence:
 * "Trip: Goa Trek. Total spent: 18,400 rupees. Pool remaining: 3,450 rupees.
 *  Settlements: Amit pays Rahul 650 rupees. Sara pays Rahul 420 rupees.
 *  All other debts cleared."
 */
export async function speakSettlementSummary(
  tripName: string,
  totalExpenses: number,
  settlements: SettlementTransaction[],
  memberMap: Map<string, string>,
  poolBalance?: number,
  options?: ReadoutOptions
): Promise<void> {
  const parts: string[] = [];

  // Header
  parts.push(`Trip: ${tripName}.`);
  parts.push(`Total spent: ${formatCurrency(totalExpenses)} rupees.`);

  // Pool status (if applicable)
  if (poolBalance !== undefined && poolBalance !== null) {
    if (poolBalance >= 0) {
      parts.push(`Pool remaining: ${formatCurrency(poolBalance)} rupees.`);
    } else {
      parts.push(`Pool deficit: ${formatCurrency(Math.abs(poolBalance))} rupees.`);
    }
  }

  // Settlements
  if (settlements.length === 0) {
    parts.push('All balances are fully settled. Nobody owes anything.');
  } else {
    parts.push(`Settlements:`);
    for (const s of settlements) {
      const fromName = memberMap.get(s.from) || 'Unknown';
      const toName = memberMap.get(s.to) || 'Unknown';
      parts.push(`${fromName} pays ${toName} ${formatCurrency(s.amount)} rupees.`);
    }
    parts.push('All other debts cleared.');
  }

  await speak(parts.join(' '), options);
}

/**
 * Speak pool status summary.
 */
export async function speakPoolStatus(
  remainingBalance: number,
  burnPercent: number,
  options?: ReadoutOptions
): Promise<void> {
  let text: string;
  if (remainingBalance >= 0) {
    text = `Pool balance: ${formatCurrency(remainingBalance)} rupees remaining. ` +
           `${burnPercent.toFixed(0)} percent spent.`;
  } else {
    text = `Pool deficit: ${formatCurrency(Math.abs(remainingBalance))} rupees. ` +
           `Pool is overdrawn.`;
  }
  await speak(text, options);
}

/**
 * Stop any active speech output.
 */
export function stopSpeaking(): void {
  try {
    Speech.stop();
  } catch {
    // Ignore
  }
}
