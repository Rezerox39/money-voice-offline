export interface Member {
  id: string;
  name: string;
  upiOrHandle?: string;
}

export interface SplitShare {
  memberId: string;
  amount: number;
}

export interface TripExpense {
  id: string;
  tripId: string;
  title: string;
  amount: number;
  paidBy: string;
  splitBetween: SplitShare[];
  category: string;
  updatedAt: number;
  poolDeposits?: PoolDeposit[];
}




export interface PersonalExpense {
  id: string;
  title: string;
  amount: number;
  category: string;
  note?: string;
  createdAt: number;
}

export interface PoolDeposit {
  id: string;
  tripId: string;
  memberId: string;
  amount: number;
  createdAt: number;
}

export interface PoolTelemetry {
  totalDeposited: number;
  totalSpentFromPool: number;
  remainingBalance: number;
  burnRatePercent: number;
}

export interface PoolRefund {
  memberId: string;
  name: string;
  deposited: number;
  refundAmount: number;
}

export interface Trip {
  id: string;
  name: string;
  currency: string;
  members: Member[];
  expenses: TripExpense[];
  createdAt: number;
  updatedAt: number;
  groupCode?: string;
}

export interface SettlementTransaction {
  from: string;
  to: string;
  amount: number;
}

export interface TripPayload {
  version: 1;
  trip: Trip;
  exportedAt: number;
}

export const CURRENCIES: Record<string, { symbol: string; code: string }> = {
  INR: { symbol: '₹', code: 'INR' },
  USD: { symbol: '$', code: 'USD' },
  EUR: { symbol: '€', code: 'EUR' },
  GBP: { symbol: '£', code: 'GBP' },
  JPY: { symbol: '¥', code: 'JPY' },
  IDR: { symbol: 'Rp', code: 'IDR' },
  AED: { symbol: 'د.إ', code: 'AED' },
};

export const CATEGORIES = [
  'Food',
  'Transport',
  'Accommodation',
  'Shopping',
  'Entertainment',
  'Utilities',
  'Other',
] as const;

export type Category = (typeof CATEGORIES)[number];

// ── Voice Engine Types ─────────────────────────────────────────────

export type VoiceEngineState =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'confirming'
  | 'writing'
  | 'error';

export interface VoicePendingEntry {
  rawTranscript: string;
  parsedDisplay: string;
  timestamp: number;
  tripId?: string;
}


