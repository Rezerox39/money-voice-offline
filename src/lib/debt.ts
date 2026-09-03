import { Member, TripExpense, SplitShare, SettlementTransaction } from '../types';

/**
 * Compute an exact equal split using minor currency units (cents/paise)
 * to prevent IEEE 754 floating-point precision errors.
 *
 * ₹100 split 3 ways → 33.34, 33.33, 33.33 (sums to exactly 100.00)
 * ₹500 split 7 ways → 71.43 × 5 + 71.42 × 2 (sums to exactly 500.00)
 */
export function computeEqualSplit(
  totalAmount: number,
  memberIds: string[]
): SplitShare[] {
  const n = memberIds.length;
  if (n === 0) return [];

  const totalMinor = Math.round(totalAmount * 100);
  const baseShare = Math.floor(totalMinor / n);
  let remainder = totalMinor % n;

  return memberIds.map((memberId) => {
    const share = baseShare + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;
    return { memberId, amount: share / 100 };
  });
}

/**
 * Minimum Cash-Flow greedy algorithm.
 * No circular payments — optimal settlement transactions.
 */
export function simplifyDebts(
  members: Member[],
  expenses: TripExpense[]
): SettlementTransaction[] {
  const netBalances = new Map<string, number>();
  members.forEach((m) => netBalances.set(m.id, 0));

  for (const exp of expenses) {
    netBalances.set(exp.paidBy, (netBalances.get(exp.paidBy) || 0) + exp.amount);
    for (const split of exp.splitBetween) {
      netBalances.set(
        split.memberId,
        (netBalances.get(split.memberId) || 0) - split.amount
      );
    }
  }

  const debtors: { id: string; amount: number }[] = [];
  const creditors: { id: string; amount: number }[] = [];

  netBalances.forEach((balance, id) => {
    const rounded = Math.round(balance * 100) / 100;
    if (rounded < -0.01) debtors.push({ id, amount: -rounded });
    else if (rounded > 0.01) creditors.push({ id, amount: rounded });
  });

  const settlements: SettlementTransaction[] = [];
  let d = 0;
  let c = 0;

  while (d < debtors.length && c < creditors.length) {
    const debtor = debtors[d];
    const creditor = creditors[c];
    const minAmount = Math.min(debtor.amount, creditor.amount);

    settlements.push({
      from: debtor.id,
      to: creditor.id,
      amount: Math.round(minAmount * 100) / 100,
    });

    debtor.amount -= minAmount;
    creditor.amount -= minAmount;

    if (Math.abs(debtor.amount) < 0.01) d++;
    if (Math.abs(creditor.amount) < 0.01) c++;
  }

  return settlements;
}

export function computeBalances(
  members: Member[],
  expenses: TripExpense[]
): Map<string, number> {
  const netBalances = new Map<string, number>();
  members.forEach((m) => netBalances.set(m.id, 0));

  for (const exp of expenses) {
    netBalances.set(exp.paidBy, (netBalances.get(exp.paidBy) || 0) + exp.amount);
    for (const split of exp.splitBetween) {
      netBalances.set(
        split.memberId,
        (netBalances.get(split.memberId) || 0) - split.amount
      );
    }
  }

  return netBalances;
}
