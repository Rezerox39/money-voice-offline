import { parseVoiceInput } from '../lib/voiceParser';

const MEMBERS = ['Amit', 'Rahul', 'Sara', 'Dada'];
const LEADER_ID = 'leader-amit-id';

// ═══════════════════════════════════════════════════════════════════
// EXACT 7-CASE SPEC TESTS — Required 100% pass rate
// ═══════════════════════════════════════════════════════════════════

describe('SPEC: Amount Disambiguation', () => {
  it('[1] "2 plates maggi 120" → { amount: 120, title: "2 plates maggi" }', () => {
    const r = parseVoiceInput('2 plates maggi 120', MEMBERS);
    expect(r.type).toBe('expense');
    if (r.type !== 'expense') return;
    expect(r.amount).toBe(120);
    expect(r.title).toBe('2 plates maggi');
  });
});

describe('SPEC: Full expense with payer and selective split', () => {
  it('[2] "Room 302 rent 4500 paid by Rahul split Rohit and me"', () => {
    const r = parseVoiceInput(
      'Room 302 rent 4500 paid by Rahul split Rohit and me',
      MEMBERS
    );
    expect(r.type).toBe('expense');
    if (r.type !== 'expense') return;
    expect(r.amount).toBe(4500);
    expect(r.title).toBe('Room 302 rent');
    expect(r.payer).toBe('Rahul');
    expect(r.splitMembers.length).toBeGreaterThanOrEqual(1);
    // "Rohit" won't match any member (not in list), "me" → __SELF__
    expect(r.splitMembers).toContain('__SELF__');
  });
});

describe('SPEC: Pool expense', () => {
  it('[3] "Chai 60 from pool" → { amount: 60, title: "Chai", paidBy: "POOL" }', () => {
    const r = parseVoiceInput('Chai 60 from pool', MEMBERS);
    expect(r.type).toBe('pool');
    if (r.type !== 'pool') return;
    expect(r.intent).toBe('POOL_WITHDRAW');
    expect(r.amount).toBe(60);
    expect((r as any).title).toBe('Chai');
  });
});

describe('SPEC: Pool deposit', () => {
  it('[4] "Add 1500 to pool" → { intent: "POOL_DEPOSIT", amount: 1500 }', () => {
    const r = parseVoiceInput('Add 1500 to pool', MEMBERS);
    expect(r.type).toBe('pool');
    if (r.type !== 'pool') return;
    expect(r.intent).toBe('POOL_DEPOSIT');
    expect(r.amount).toBe(1500);
  });
});

describe('SPEC: Leader fallback', () => {
  it('[5] "Petrol 850" (with leader set) → { amount: 850, payer: LEADER_ID }', () => {
    const r = parseVoiceInput('Petrol 850', {
      memberNames: MEMBERS,
      leaderId: LEADER_ID,
    });
    expect(r.type).toBe('expense');
    if (r.type !== 'expense') return;
    expect(r.amount).toBe(850);
    expect(r.payer).toBe(LEADER_ID);
  });
});

describe('SPEC: Settlement query', () => {
  it('[6] "Who owes what" → { intent: "QUERY_SETTLEMENT" }', () => {
    const r = parseVoiceInput('Who owes what', MEMBERS);
    expect(r.type).toBe('query');
    if (r.type !== 'query') return;
    expect(r.intent).toBe('QUERY_SETTLEMENT');
  });
});

describe('SPEC: Personal expense', () => {
  it('[7] "Chai 30 personal" → { intent: "ADD_EXPENSE", isPersonal: true, amount: 30 }', () => {
    const r = parseVoiceInput('Chai 30 personal', MEMBERS);
    expect(r.type).toBe('expense');
    if (r.type !== 'expense') return;
    expect(r.intent).toBe('ADD_EXPENSE');
    expect(r.isPersonal).toBe(true);
    expect(r.amount).toBe(30);
  });
});

// ═══════════════════════════════════════════════════════════════════
// AMOUNT DISAMBIGUATION EDGE CASES
// ═══════════════════════════════════════════════════════════════════

describe('Amount Disambiguation — Edge Cases', () => {
  it('distinguishes item count from amount: "3 samosa 90"', () => {
    const r = parseVoiceInput('3 samosa 90', MEMBERS);
    expect(r.type).toBe('expense');
    if (r.type !== 'expense') return;
    expect(r.amount).toBe(90);
    expect(r.title.toLowerCase()).toContain('samosa');
  });

  it('currency prefix takes priority: "₹450 chai"', () => {
    const r = parseVoiceInput('₹450 chai', MEMBERS);
    expect(r.type).toBe('expense');
    if (r.type !== 'expense') return;
    expect(r.amount).toBe(450);
  });

  it('rs prefix: "rs 500 dinner"', () => {
    const r = parseVoiceInput('rs 500 dinner', MEMBERS);
    expect(r.type).toBe('expense');
    if (r.type !== 'expense') return;
    expect(r.amount).toBe(500);
  });

  it('comma-formatted: "₹1,200 chai"', () => {
    const r = parseVoiceInput('₹1,200 chai', MEMBERS);
    expect(r.type).toBe('expense');
    if (r.type !== 'expense') return;
    expect(r.amount).toBe(1200);
  });

  it('decimal amount: "99999.99 hotel"', () => {
    const r = parseVoiceInput('99999.99 hotel', MEMBERS);
    expect(r.type).toBe('expense');
    if (r.type !== 'expense') return;
    expect(r.amount).toBe(99999.99);
  });

  it('keyword after amount: "chai 120"', () => {
    const r = parseVoiceInput('chai 120', MEMBERS);
    expect(r.type).toBe('expense');
    if (r.type !== 'expense') return;
    expect(r.amount).toBe(120);
  });

  it('street number in title preserved: "Room 302 rent 4500"', () => {
    const r = parseVoiceInput('Room 302 rent 4500', MEMBERS);
    expect(r.type).toBe('expense');
    if (r.type !== 'expense') return;
    expect(r.amount).toBe(4500);
    expect(r.title).toContain('302');
  });
});

// ═══════════════════════════════════════════════════════════════════
// POOL / KITTY INVOCATIONS
// ═══════════════════════════════════════════════════════════════════

describe('Pool Invocations', () => {
  it('"Chai 60 from kitty" → POOL_WITHDRAW', () => {
    const r = parseVoiceInput('Chai 60 from kitty', MEMBERS);
    expect(r.type).toBe('pool');
    if (r.type !== 'pool') return;
    expect(r.intent).toBe('POOL_WITHDRAW');
    expect(r.amount).toBe(60);
  });

  it('"Petrol 200 from fund" → POOL_WITHDRAW', () => {
    const r = parseVoiceInput('Petrol 200 from fund', MEMBERS);
    expect(r.type).toBe('pool');
    if (r.type !== 'pool') return;
    expect(r.intent).toBe('POOL_WITHDRAW');
    expect(r.amount).toBe(200);
  });

  it('"Add 2000 to kitty from Rahul" → POOL_DEPOSIT with payer', () => {
    const r = parseVoiceInput('Add 2000 to kitty from Rahul', MEMBERS);
    expect(r.type).toBe('pool');
    if (r.type !== 'pool') return;
    expect(r.intent).toBe('POOL_DEPOSIT');
    expect(r.amount).toBe(2000);
    expect((r as any).payerId).toBe('Rahul');
  });

  it('"Deposit 500 to common cash" → POOL_DEPOSIT', () => {
    const r = parseVoiceInput('Deposit 500 to common cash', MEMBERS);
    expect(r.type).toBe('pool');
    if (r.type !== 'pool') return;
    expect(r.intent).toBe('POOL_DEPOSIT');
    expect(r.amount).toBe(500);
  });

  it('"Pool 3000" → expense with isPool flag', () => {
    const r = parseVoiceInput('Pool 3000', MEMBERS);
    expect(r.type).toBe('expense');
    if (r.type !== 'expense') return;
    expect(r.isPool).toBe(true);
    expect(r.amount).toBe(3000);
  });
});

// ═══════════════════════════════════════════════════════════════════
// PAYER & SPLIT MATCHING
// ═══════════════════════════════════════════════════════════════════

describe('Payer Detection', () => {
  it('"Rahul paid 500 split with all" → payer: Rahul', () => {
    const r = parseVoiceInput('Rahul paid 500 split with all', MEMBERS);
    expect(r.type).toBe('expense');
    if (r.type !== 'expense') return;
    expect(r.payer).toBe('Rahul');
  });

  it('"Amit ne diya 300" → payer: Amit', () => {
    const r = parseVoiceInput('Amit ne diya 300', MEMBERS);
    expect(r.type).toBe('expense');
    if (r.type !== 'expense') return;
    expect(r.payer).toBe('Amit');
  });

  it('"paid by XYZ 500" → payer falls to leader/self', () => {
    const r = parseVoiceInput('paid by XYZ 500', {
      memberNames: MEMBERS,
      leaderId: LEADER_ID,
    });
    expect(r.type).toBe('expense');
    if (r.type !== 'expense') return;
    // XYZ not in member list, leader fallback
    expect(r.payer).toBe(LEADER_ID);
  });

  it('no payer + no leader → __SELF__', () => {
    const r = parseVoiceInput('chai 30', MEMBERS);
    expect(r.type).toBe('expense');
    if (r.type !== 'expense') return;
    expect(r.payer).toBe('__SELF__');
  });
});

describe('Split Detection', () => {
  it('"split Rohit and me" → selective split with __SELF__', () => {
    const r = parseVoiceInput('Dinner 600 split Rohit and me', MEMBERS);
    expect(r.type).toBe('expense');
    if (r.type !== 'expense') return;
    expect(r.splitMembers).toContain('__SELF__');
  });

  it('"split with all" → equal split (empty = all)', () => {
    const r = parseVoiceInput('Dinner 1200 split with all', MEMBERS);
    expect(r.type).toBe('expense');
    if (r.type !== 'expense') return;
    expect(r.splitMode).toBe('equal');
    expect(r.splitMembers).toEqual([]);
  });

  it('"Lunch 600, Amit 400, me 200" → exact split', () => {
    const r = parseVoiceInput('Lunch 600, Amit 400, me 200', MEMBERS);
    expect(r.type).toBe('expense');
    if (r.type !== 'expense') return;
    expect(r.splitMode).toBe('exact');
    expect(r.exactSplits['Amit']).toBe(400);
    expect(r.exactSplits['__SELF__']).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════════
// PERSONAL EXPENSE DETECTION
// ═══════════════════════════════════════════════════════════════════

describe('Personal Expense Detection', () => {
  it('"Chai 30" with no split keyword → personal', () => {
    const r = parseVoiceInput('Chai 30', MEMBERS);
    expect(r.type).toBe('expense');
    if (r.type !== 'expense') return;
    expect(r.isPersonal).toBe(true);
  });

  it('"Petrol 500 card" → personal', () => {
    const r = parseVoiceInput('Petrol 500 card', MEMBERS);
    expect(r.type).toBe('expense');
    if (r.type !== 'expense') return;
    expect(r.isPersonal).toBe(true);
  });

  it('"Chai 30 own" → personal', () => {
    const r = parseVoiceInput('Chai 30 own', MEMBERS);
    expect(r.type).toBe('expense');
    if (r.type !== 'expense') return;
    expect(r.isPersonal).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// CATEGORY DETECTION
// ═══════════════════════════════════════════════════════════════════

describe('Category Detection', () => {
  it('chai → Food', () => {
    const r = parseVoiceInput('chai 30', MEMBERS);
    expect(r.type).toBe('expense');
    if (r.type !== 'expense') return;
    expect(r.category).toBe('Food');
  });

  it('petrol → Transport', () => {
    const r = parseVoiceInput('petrol 500', MEMBERS);
    expect(r.type).toBe('expense');
    if (r.type !== 'expense') return;
    expect(r.category).toBe('Transport');
  });

  it('hotel → Accommodation', () => {
    const r = parseVoiceInput('hotel 2000', MEMBERS);
    expect(r.type).toBe('expense');
    if (r.type !== 'expense') return;
    expect(r.category).toBe('Accommodation');
  });

  it('movie ticket → Entertainment', () => {
    const r = parseVoiceInput('movie ticket 300', MEMBERS);
    expect(r.type).toBe('expense');
    if (r.type !== 'expense') return;
    expect(r.category).toBe('Entertainment');
  });
});

// ═══════════════════════════════════════════════════════════════════
// QUERY DETECTION
// ═══════════════════════════════════════════════════════════════════

describe('Query Detection', () => {
  it('"who owes what?" → QUERY_SETTLEMENT', () => {
    const r = parseVoiceInput('who owes what?', MEMBERS);
    expect(r.type).toBe('query');
    if (r.type !== 'query') return;
    expect(r.intent).toBe('QUERY_SETTLEMENT');
  });

  it('"total expense" → QUERY_TOTAL', () => {
    const r = parseVoiceInput('total expense', MEMBERS);
    expect(r.type).toBe('query');
    if (r.type !== 'query') return;
    expect(r.intent).toBe('QUERY_TOTAL');
  });

  it('"how much did Rahul pay?" → QUERY_MEMBER', () => {
    const r = parseVoiceInput('how much did Rahul pay?', MEMBERS);
    expect(r.type).toBe('query');
    if (r.type !== 'query') return;
    expect(r.intent).toBe('QUERY_MEMBER');
    expect(r.memberName).toBe('Rahul');
  });
});

// ═══════════════════════════════════════════════════════════════════
// COMMAND DETECTION
// ═══════════════════════════════════════════════════════════════════

describe('Command Detection', () => {
  it('"undo last" → COMMAND_UNDO', () => {
    const r = parseVoiceInput('undo last', MEMBERS);
    expect(r.type).toBe('command');
    if (r.type !== 'command') return;
    expect(r.intent).toBe('COMMAND_UNDO');
  });

  it('"show QR" → COMMAND_QR', () => {
    const r = parseVoiceInput('show QR', MEMBERS);
    expect(r.type).toBe('command');
    if (r.type !== 'command') return;
    expect(r.intent).toBe('COMMAND_QR');
  });

  it('"read settlement" → COMMAND_READ_SETTLEMENT', () => {
    const r = parseVoiceInput('read settlement', MEMBERS);
    expect(r.type).toBe('command');
    if (r.type !== 'command') return;
    expect(r.intent).toBe('COMMAND_READ_SETTLEMENT');
  });

  it('"help" → COMMAND_HELP', () => {
    const r = parseVoiceInput('help', MEMBERS);
    expect(r.type).toBe('command');
    if (r.type !== 'command') return;
    expect(r.intent).toBe('COMMAND_HELP');
  });

  it('"switch to Ladakh trip" → COMMAND_SWITCH', () => {
    const r = parseVoiceInput('switch to Ladakh trip', MEMBERS);
    expect(r.type).toBe('command');
    if (r.type !== 'command') return;
    expect(r.intent).toBe('COMMAND_SWITCH');
    expect(r.tripName).toContain('ladakh');
  });
});

// ═══════════════════════════════════════════════════════════════════
// EDGE CASES
// ═══════════════════════════════════════════════════════════════════

describe('Edge Cases', () => {
  it('empty string → COMMAND_HELP', () => {
    const r = parseVoiceInput('', MEMBERS);
    expect(r.type).toBe('command');
    if (r.type === 'command') {
      expect(r.intent).toBe('COMMAND_HELP');
    }
  });

  it('no amount → QUERY_TOTAL', () => {
    const r = parseVoiceInput('recent expenses', MEMBERS);
    expect(r.type).toBe('query');
  });

  it('hindi/english mix: "chai 30 diya"', () => {
    const r = parseVoiceInput('chai 30 diya', MEMBERS);
    expect(r.type).toBe('expense');
    if (r.type !== 'expense') return;
    expect(r.amount).toBe(30);
    expect(r.isPersonal).toBe(true);
  });

  it('"Auto 150 split with Rohan" → Transport category', () => {
    const r = parseVoiceInput('Auto 150 split with Rohan', MEMBERS);
    expect(r.type).toBe('expense');
    if (r.type !== 'expense') return;
    expect(r.amount).toBe(150);
    expect(r.category).toBe('Transport');
  });
});
