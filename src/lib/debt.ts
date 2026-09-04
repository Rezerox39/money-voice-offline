import { Member, TripExpense, SplitShare, SettlementTransaction, PoolDeposit, PoolTelemetry, PoolRefund } from '../types';

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

// ── Pool Telemetry (event-sourced, computed on read) ───────────────

export function computePoolTelemetry(
  deposits: PoolDeposit[],
  expenses: TripExpense[]
): PoolTelemetry {
  const totalDeposited = deposits.reduce((sum, d) => sum + d.amount, 0);
  const totalSpentFromPool = expenses
    .filter((e) => e.paidBy === 'POOL')
    .reduce((sum, e) => sum + e.amount, 0);
  const remainingBalance = totalDeposited - totalSpentFromPool;
  const burnRatePercent =
    totalDeposited > 0
      ? Math.round((totalSpentFromPool / totalDeposited) * 10000) / 100
      : 0;

  return { totalDeposited, totalSpentFromPool, remainingBalance, burnRatePercent };
}

/**
 * Compute proportional refunds for trip dissolution.
 * Each member gets back their deposited amount minus their proportional
 * share of pool expenses (if any). Uses minor-unit precision with
 * remainder distribution to prevent cent leakage.
 */
export function computePoolRefunds(
  deposits: PoolDeposit[],
  expenses: TripExpense[],
  members: Member[]
): PoolRefund[] {
  const totalDeposited = deposits.reduce((sum, d) => sum + d.amount, 0);
  const totalSpentFromPool = expenses
    .filter((e) => e.paidBy === 'POOL')
    .reduce((sum, e) => sum + e.amount, 0);

  // If no pool expenses or no deposits, refund exact deposited amounts
  if (totalSpentFromPool === 0 || totalDeposited === 0) {
    const byMember = new Map<string, number>();
    for (const d of deposits) {
      byMember.set(d.memberId, (byMember.get(d.memberId) ?? 0) + d.amount);
    }
    return members
      .filter((m) => (byMember.get(m.id) ?? 0) > 0)
      .map((m) => ({
        memberId: m.id,
        name: m.name,
        deposited: byMember.get(m.id)!,
        refundAmount: byMember.get(m.id)!,
      }));
  }

  // Each member's share of pool expenses = (their deposits / total deposited) * total spent
  const memberDeposited = new Map<string, number>();
  for (const d of deposits) {
    memberDeposited.set(d.memberId, (memberDeposited.get(d.memberId) ?? 0) + d.amount);
  }

  // Use minor units to avoid floating point issues
  const totalDepositedMinor = Math.round(totalDeposited * 100);
  const totalSpentMinor = Math.round(totalSpentFromPool * 100);

  const refunds: PoolRefund[] = [];
  let spentAllocatedMinor = 0;

  const entries = Array.from(memberDeposited.entries());
  for (let i = 0; i < entries.length; i++) {
    const [memberId, deposited] = entries[i];
    const depositedMinor = Math.round(deposited * 100);

    // Proportional share of expenses
    let spentShareMinor: number;
    if (i === entries.length - 1) {
      // Last member absorbs any rounding remainder
      spentShareMinor = totalSpentMinor - spentAllocatedMinor;
    } else {
      spentShareMinor = Math.round((depositedMinor / totalDepositedMinor) * totalSpentMinor);
      spentAllocatedMinor += spentShareMinor;
    }

    const refundMinor = depositedMinor - spentShareMinor;
    const refundAmount = Math.max(0, refundMinor / 100);

    const member = members.find((m) => m.id === memberId);
    refunds.push({
      memberId,
      name: member?.name ?? memberId,
      deposited,
      refundAmount: Math.round(refundAmount * 100) / 100,
    });
  }

  return refunds.filter((r) => r.refundAmount > 0);
}
