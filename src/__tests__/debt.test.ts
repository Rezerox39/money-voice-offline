import { simplifyDebts, computeBalances } from '../lib/debt';
import { Member, TripExpense } from '../types';

const alice: Member = { id: 'a', name: 'Alice' };
const bob: Member = { id: 'b', name: 'Bob' };
const carol: Member = { id: 'c', name: 'Carol' };

describe('simplifyDebts', () => {
  it('returns empty when no expenses exist', () => {
    const result = simplifyDebts([alice, bob], []);
    expect(result).toEqual([]);
  });

  it('splits a single shared expense equally', () => {
    const expenses: TripExpense[] = [
      {
        id: 'e1',
        tripId: 't1',
        title: 'Dinner',
        amount: 100,
        paidBy: 'a',
        splitBetween: [
          { memberId: 'a', amount: 50 },
          { memberId: 'b', amount: 50 },
        ],
        category: 'Food',
        updatedAt: Date.now(),
      },
    ];

    const result = simplifyDebts([alice, bob], expenses);
    // Alice paid 100, owes 50 → net +50. Bob owes 50.
    expect(result.length).toBe(1);
    expect(result[0]).toEqual({ from: 'b', to: 'a', amount: 50 });
  });

  it('handles three-way split with one payer', () => {
    const expenses: TripExpense[] = [
      {
        id: 'e1',
        tripId: 't1',
        title: 'Hotel',
        amount: 300,
        paidBy: 'a',
        splitBetween: [
          { memberId: 'a', amount: 100 },
          { memberId: 'b', amount: 100 },
          { memberId: 'c', amount: 100 },
        ],
        category: 'Accommodation',
        updatedAt: Date.now(),
      },
    ];

    const result = simplifyDebts([alice, bob, carol], expenses);
    // Alice: +300 paid - 100 owes = +200 net
    // Bob: -100 owes = -100 net
    // Carol: -100 owes = -100 net
    expect(result.length).toBe(2);
    const totalTransfers = result.reduce((s, t) => s + t.amount, 0);
    expect(totalTransfers).toBe(200);
  });

  it('no circular payments in complex scenario', () => {
    // Alice paid 200 (split: a=100, b=50, c=50)
    // Bob paid 150 (split: a=50, b=50, c=50)
    // Net: Alice = +200-100-50 = +50, Bob = +150-50-50 = +50, Carol = -50-50 = -100
    const expenses: TripExpense[] = [
      {
        id: 'e1',
        tripId: 't1',
        title: 'Taxi',
        amount: 200,
        paidBy: 'a',
        splitBetween: [
          { memberId: 'a', amount: 100 },
          { memberId: 'b', amount: 50 },
          { memberId: 'c', amount: 50 },
        ],
        category: 'Transport',
        updatedAt: Date.now(),
      },
      {
        id: 'e2',
        tripId: 't1',
        title: 'Lunch',
        amount: 150,
        paidBy: 'b',
        splitBetween: [
          { memberId: 'a', amount: 50 },
          { memberId: 'b', amount: 50 },
          { memberId: 'c', amount: 50 },
        ],
        category: 'Food',
        updatedAt: Date.now(),
      },
    ];

    const result = simplifyDebts([alice, bob, carol], expenses);
    // Carol owes 100 total. Best: Carol → Alice 50, Carol → Bob 50 (2 transactions)
    // No cycles possible here. Verify:
    expect(result.length).toBe(2);
    const totalTransfers = result.reduce((s, t) => s + t.amount, 0);
    expect(totalTransfers).toBe(100);

    // Verify no circular payment (A→B and B→A simultaneously)
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const isCircular =
          (result[i].from === result[j].to && result[i].to === result[j].from);
        expect(isCircular).toBe(false);
      }
    }
  });

  it('settles exactly with no residual cents', () => {
    // ₹33.33 + ₹33.33 + ₹33.34 = ₹100.00
    const expenses: TripExpense[] = [
      {
        id: 'e1',
        tripId: 't1',
        title: 'Meal',
        amount: 100,
        paidBy: 'a',
        splitBetween: [
          { memberId: 'a', amount: 33.34 },
          { memberId: 'b', amount: 33.33 },
          { memberId: 'c', amount: 33.33 },
        ],
        category: 'Food',
        updatedAt: Date.now(),
      },
    ];

    const balances = computeBalances([alice, bob, carol], expenses);
    const sum = Array.from(balances.values()).reduce((s, v) => s + v, 0);
    expect(sum).toBe(0);
  });
});

describe('computeBalances', () => {
  it('computes net balances correctly', () => {
    const expenses: TripExpense[] = [
      {
        id: 'e1',
        tripId: 't1',
        title: 'Taxi',
        amount: 60,
        paidBy: 'a',
        splitBetween: [
          { memberId: 'a', amount: 30 },
          { memberId: 'b', amount: 30 },
        ],
        category: 'Transport',
        updatedAt: Date.now(),
      },
    ];

    const balances = computeBalances([alice, bob], expenses);
    expect(balances.get('a')).toBe(30); // paid 60, owes 30
    expect(balances.get('b')).toBe(-30); // owes 30
  });

  it('balances sum to zero', () => {
    const expenses: TripExpense[] = [
      {
        id: 'e1',
        tripId: 't1',
        title: 'A',
        amount: 100,
        paidBy: 'a',
        splitBetween: [
          { memberId: 'a', amount: 50 },
          { memberId: 'b', amount: 50 },
        ],
        category: 'Food',
        updatedAt: Date.now(),
      },
      {
        id: 'e2',
        tripId: 't1',
        title: 'B',
        amount: 80,
        paidBy: 'b',
        splitBetween: [
          { memberId: 'a', amount: 40 },
          { memberId: 'b', amount: 40 },
        ],
        category: 'Food',
        updatedAt: Date.now(),
      },
    ];

    const balances = computeBalances([alice, bob], expenses);
    const sum = Array.from(balances.values()).reduce((s, v) => s + v, 0);
    expect(sum).toBe(0);
  });
});
