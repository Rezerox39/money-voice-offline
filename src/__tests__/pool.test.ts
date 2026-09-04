import { computePoolTelemetry, computePoolRefunds, computeEqualSplit } from '../lib/debt';
import { PoolDeposit, TripExpense, Member } from '../types';

const alice: Member = { id: 'a', name: 'Alice' };
const bob: Member = { id: 'b', name: 'Bob' };
const carol: Member = { id: 'c', name: 'Carol' };

function makeDeposit(id: string, memberId: string, amount: number, ts: number): PoolDeposit {
  return { id, tripId: 't1', memberId, amount, createdAt: ts };
}

function makePoolExpense(id: string, amount: number, title: string): TripExpense {
  return {
    id,
    tripId: 't1',
    title,
    amount,
    paidBy: 'POOL',
    splitBetween: [],
    category: 'Food',
    updatedAt: Date.now(),
  };
}

describe('computePoolTelemetry', () => {
  it('sums multiple deposits correctly', () => {
    const deposits = [
      makeDeposit('d1', 'a', 500, 1000),
      makeDeposit('d2', 'b', 300, 2000),
      makeDeposit('d3', 'a', 200, 3000),
    ];
    const telemetry = computePoolTelemetry(deposits, []);
    expect(telemetry.totalDeposited).toBe(1000);
    expect(telemetry.totalSpentFromPool).toBe(0);
    expect(telemetry.remainingBalance).toBe(1000);
    expect(telemetry.burnRatePercent).toBe(0);
  });

  it('expenses with paidBy POOL reduce remaining balance', () => {
    const deposits = [
      makeDeposit('d1', 'a', 1000, 1000),
      makeDeposit('d2', 'b', 500, 2000),
    ];
    const expenses = [
      makePoolExpense('e1', 400, 'Chai'),
      makePoolExpense('e2', 200, 'Snacks'),
    ];
    const telemetry = computePoolTelemetry(deposits, expenses);
    expect(telemetry.totalDeposited).toBe(1500);
    expect(telemetry.totalSpentFromPool).toBe(600);
    expect(telemetry.remainingBalance).toBe(900);
    expect(telemetry.burnRatePercent).toBe(40);
  });

  it('handles zero deposits', () => {
    const telemetry = computePoolTelemetry([], []);
    expect(telemetry.totalDeposited).toBe(0);
    expect(telemetry.remainingBalance).toBe(0);
    expect(telemetry.burnRatePercent).toBe(0);
  });

  it('deficit when spending exceeds deposits', () => {
    const deposits = [makeDeposit('d1', 'a', 200, 1000)];
    const expenses = [makePoolExpense('e1', 500, 'Hotel')];
    const telemetry = computePoolTelemetry(deposits, expenses);
    expect(telemetry.remainingBalance).toBe(-300);
  });

  it('non-pool expenses do not affect pool balance', () => {
    const deposits = [makeDeposit('d1', 'a', 1000, 1000)];
    const nonPoolExpense: TripExpense = {
      id: 'e1', tripId: 't1', title: 'Taxi', amount: 300,
      paidBy: 'a', splitBetween: [{ memberId: 'a', amount: 300 }],
      category: 'Transport', updatedAt: Date.now(),
    };
    const telemetry = computePoolTelemetry(deposits, [nonPoolExpense]);
    expect(telemetry.totalSpentFromPool).toBe(0);
    expect(telemetry.remainingBalance).toBe(1000);
  });
});

describe('computePoolRefunds', () => {
  it('returns exact deposited amounts when no pool expenses exist', () => {
    const deposits = [
      makeDeposit('d1', 'a', 500, 1000),
      makeDeposit('d2', 'b', 300, 2000),
    ];
    const refunds = computePoolRefunds(deposits, [], [alice, bob, carol]);
    expect(refunds.length).toBe(2);
    const aliceRefund = refunds.find((r) => r.memberId === 'a')!;
    const bobRefund = refunds.find((r) => r.memberId === 'b')!;
    expect(aliceRefund.refundAmount).toBe(500);
    expect(bobRefund.refundAmount).toBe(300);
  });

  it('proportional refund for odd distributions with zero cent leakage', () => {
    // Alice deposited 600, Bob deposited 400. Total pool spend = 300.
    // Alice's share of spend = 600/1000 * 300 = 180
    // Bob's share of spend = 400/1000 * 300 = 120
    // Alice refund = 600 - 180 = 420
    // Bob refund = 400 - 120 = 280
    const deposits = [
      makeDeposit('d1', 'a', 600, 1000),
      makeDeposit('d2', 'b', 400, 2000),
    ];
    const expenses = [makePoolExpense('e1', 300, 'Dinner')];
    const refunds = computePoolRefunds(deposits, expenses, [alice, bob]);

    const totalRefund = refunds.reduce((s, r) => s + r.refundAmount, 0);
    // Total refund should equal totalDeposited - totalSpent = 600 + 400 - 300 = 700
    expect(totalRefund).toBe(700);

    const aliceRefund = refunds.find((r) => r.memberId === 'a')!;
    const bobRefund = refunds.find((r) => r.memberId === 'b')!;
    expect(aliceRefund.refundAmount).toBe(420);
    expect(bobRefund.refundAmount).toBe(280);
  });

  it('handles 3-way odd split with remainder distribution', () => {
    // Alice 333, Bob 333, Carol 334 → total 1000
    // Pool spend = 100
    // Alice: 333/1000 * 100 = 33.30 → refund 333 - 33.30 = 299.70
    // Bob:   333/1000 * 100 = 33.30 → refund 333 - 33.30 = 299.70
    // Carol: remaining = 100 - 33.30 - 33.30 = 33.40 → refund 334 - 33.40 = 300.60
    const deposits = [
      makeDeposit('d1', 'a', 333, 1000),
      makeDeposit('d2', 'b', 333, 2000),
      makeDeposit('d3', 'c', 334, 3000),
    ];
    const expenses = [makePoolExpense('e1', 100, 'Tea')];
    const refunds = computePoolRefunds(deposits, expenses, [alice, bob, carol]);

    const totalRefund = refunds.reduce((s, r) => s + r.refundAmount, 0);
    expect(totalRefund).toBe(900); // 1000 - 100

    // Check no cent leakage in minor units
    const totalRefundMinor = refunds.reduce(
      (s, r) => s + Math.round(r.refundAmount * 100),
      0
    );
    expect(totalRefundMinor).toBe(90000); // 900 * 100
  });

  it('members with zero deposits are excluded', () => {
    const deposits = [makeDeposit('d1', 'a', 500, 1000)];
    const refunds = computePoolRefunds(deposits, [], [alice, bob, carol]);
    expect(refunds.length).toBe(1);
    expect(refunds[0].memberId).toBe('a');
  });

  it('multiple deposits per member are aggregated', () => {
    const deposits = [
      makeDeposit('d1', 'a', 100, 1000),
      makeDeposit('d2', 'a', 200, 2000),
      makeDeposit('d3', 'b', 150, 3000),
    ];
    const expenses = [makePoolExpense('e1', 90, 'Food')];
    const refunds = computePoolRefunds(deposits, expenses, [alice, bob]);
    const totalRefund = refunds.reduce((s, r) => s + r.refundAmount, 0);
    // 300 + 150 - 90 = 360
    expect(totalRefund).toBe(360);
  });
});

describe('computeEqualSplit (pool integration)', () => {
  it('split pool expense among all members', () => {
    const splits = computeEqualSplit(100, ['a', 'b', 'c']);
    const total = splits.reduce((s, sp) => s + sp.amount, 0);
    expect(total).toBe(100);
    expect(splits.length).toBe(3);
  });
});
