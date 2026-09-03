import { computeEqualSplit } from '../lib/debt';

describe('computeEqualSplit', () => {
  const alice = 'alice-id';
  const bob = 'bob-id';
  const carol = 'carol-id';
  const dave = 'dave-id';
  const eve = 'eve-id';
  const frank = 'frank-id';
  const grace = 'grace-id';

  it('splits ₹100 among 3 with zero cent leakage', () => {
    const splits = computeEqualSplit(100, [alice, bob, carol]);
    const total = splits.reduce((s, sp) => s + sp.amount, 0);

    expect(total).toBe(100);
    expect(splits.length).toBe(3);

    // One member gets the extra cent (33.34 vs 33.33)
    const amounts = splits.map((s) => s.amount).sort((a, b) => b - a);
    expect(amounts[0]).toBe(33.34);
    expect(amounts[1]).toBe(33.33);
    expect(amounts[2]).toBe(33.33);
  });

  it('splits ₹500 among 7 with zero cent leakage', () => {
    const ids = [alice, bob, carol, dave, eve, frank, grace];
    const splits = computeEqualSplit(500, ids);

    expect(splits.length).toBe(7);

    // 500 * 100 = 50000 cents. 50000 / 7 = 7142 remainder 6
    // So 6 members get 71.43, 1 gets 71.42
    const amounts = splits.map((s) => s.amount).sort((a, b) => b - a);
    expect(amounts[0]).toBe(71.43);
    expect(amounts[6]).toBe(71.42);

    // Sum of minor units must be exact (no cent leakage)
    const totalMinor = splits.reduce((s, sp) => s + Math.round(sp.amount * 100), 0);
    expect(totalMinor).toBe(50000);
  });

  it('splits ₹10 among 2 evenly', () => {
    const splits = computeEqualSplit(10, [alice, bob]);
    const total = splits.reduce((s, sp) => s + sp.amount, 0);

    expect(total).toBe(10);
    expect(splits[0].amount).toBe(5);
    expect(splits[1].amount).toBe(5);
  });

  it('splits ₹1 among 3 (sub-cent amounts)', () => {
    const splits = computeEqualSplit(1, [alice, bob, carol]);
    const total = splits.reduce((s, sp) => s + sp.amount, 0);

    // 1 * 100 = 100 cents / 3 = 33 remainder 1
    // So 1 gets 0.34, 2 get 0.33
    expect(total).toBe(1);
    const amounts = splits.map((s) => s.amount).sort((a, b) => b - a);
    expect(amounts[0]).toBe(0.34);
    expect(amounts[1]).toBe(0.33);
    expect(amounts[2]).toBe(0.33);
  });

  it('handles single member (no split needed)', () => {
    const splits = computeEqualSplit(42, [alice]);
    expect(splits.length).toBe(1);
    expect(splits[0].amount).toBe(42);
    expect(splits[0].memberId).toBe(alice);
  });

  it('returns empty array for zero members', () => {
    const splits = computeEqualSplit(100, []);
    expect(splits).toEqual([]);
  });

  it('handles large amount ₹99999.99 among 3', () => {
    const splits = computeEqualSplit(99999.99, [alice, bob, carol]);
    const total = splits.reduce((s, sp) => s + sp.amount, 0);
    expect(total).toBe(99999.99);
  });

  it('never produces negative amounts', () => {
    const splits = computeEqualSplit(0.03, [alice, bob, carol]);
    const total = splits.reduce((s, sp) => s + sp.amount, 0);
    expect(total).toBe(0.03);
    splits.forEach((s) => expect(s.amount).toBeGreaterThanOrEqual(0));
  });
});
