// Offline currency conversion rates (approximate, for reference only)
// In a fully offline app these are static reference rates.

const RATE_TABLE: Record<string, number> = {
  INR: 1,
  USD: 0.012,
  EUR: 0.011,
  GBP: 0.0095,
  JPY: 1.80,
  IDR: 189.0,
  AED: 0.044,
};

export function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
): number {
  const fromRate = RATE_TABLE[fromCurrency];
  const toRate = RATE_TABLE[toCurrency];
  if (!fromRate || !toRate) return amount;

  const inINR = amount / fromRate;
  const converted = inINR * toRate;
  return Math.round(converted * 100) / 100;
}

export function getConversionNote(from: string, to: string): string {
  if (from === to) return '';
  return `Approx offline rate: 1 ${from} ≈ ${(RATE_TABLE[to] / RATE_TABLE[from]).toFixed(4)} ${to}`;
}
