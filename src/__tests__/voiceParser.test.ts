import { parseVoiceInput } from '../lib/voiceParser';

const MEMBERS = ['Amit', 'Rahul', 'Sara', 'Dada'];

describe('voiceParser — Expense Parsing', () => {
  it('parses "Dinner 1200 split with all"', () => {
    const result = parseVoiceInput('Dinner 1200 split with all', MEMBERS);
    expect(result.type).toBe('expense');
    if (result.type !== 'expense') return;
    expect(result.title).toBe('Dinner');
    expect(result.amount).toBe(1200);
    expect(result.splitMode).toBe('equal');
    expect(result.splitMembers).toEqual([]); // empty = all
    expect(result.isPersonal).toBe(false);
  });

  it('parses "Paid 1500 for dinner split with all"', () => {
    const result = parseVoiceInput('Paid 1500 for dinner split with all', MEMBERS);
    expect(result.type).toBe('expense');
    if (result.type !== 'expense') return;
    expect(result.amount).toBe(1500);
    expect(result.payer).toBe('__SELF__');
  });

  it('parses "800 diesel paid by Rahul split between Rahul, Amit, and me"', () => {
    const result = parseVoiceInput(
      '800 diesel paid by Rahul split between Rahul, Amit, and me',
      MEMBERS
    );
    expect(result.type).toBe('expense');
    if (result.type !== 'expense') return;
    expect(result.amount).toBe(800);
    expect(result.payer).toBe('Rahul');
    expect(result.splitMembers.length).toBeGreaterThanOrEqual(2);
  });

  it('parses "Lunch 600, Amit 400, me 200" as exact split', () => {
    const result = parseVoiceInput('Lunch 600, Amit 400, me 200', MEMBERS);
    expect(result.type).toBe('expense');
    if (result.type !== 'expense') return;
    expect(result.amount).toBe(600);
    expect(result.splitMode).toBe('exact');
    expect(result.exactSplits['Amit']).toBe(400);
    expect(result.exactSplits['__SELF__']).toBe(200);
  });

  it('parses personal expense "Chai 30"', () => {
    const result = parseVoiceInput('Chai 30', MEMBERS);
    expect(result.type).toBe('expense');
    if (result.type !== 'expense') return;
    expect(result.title).toBe('Chai');
    expect(result.amount).toBe(30);
    expect(result.isPersonal).toBe(true);
    expect(result.splitMode).toBe('none');
  });

  it('parses "Petrol 500 card" as personal', () => {
    const result = parseVoiceInput('Petrol 500 card', MEMBERS);
    expect(result.type).toBe('expense');
    if (result.type !== 'expense') return;
    expect(result.title).toBe('Petrol');
    expect(result.amount).toBe(500);
    expect(result.isPersonal).toBe(true);
  });

  it('parses amount with ₹ symbol "₹1200 chai"', () => {
    const result = parseVoiceInput('₹1200 chai', MEMBERS);
    expect(result.type).toBe('expense');
    if (result.type !== 'expense') return;
    expect(result.amount).toBe(1200);
  });

  it('parses amount with rs prefix "rs 500 dinner"', () => {
    const result = parseVoiceInput('rs 500 dinner', MEMBERS);
    expect(result.type).toBe('expense');
    if (result.type !== 'expense') return;
    expect(result.amount).toBe(500);
  });

  it('detects Food category from "chai"', () => {
    const result = parseVoiceInput('chai 30', MEMBERS);
    expect(result.type).toBe('expense');
    if (result.type !== 'expense') return;
    expect(result.category).toBe('Food');
  });

  it('detects Transport category from "petrol"', () => {
    const result = parseVoiceInput('petrol 500', MEMBERS);
    expect(result.type).toBe('expense');
    if (result.type !== 'expense') return;
    expect(result.category).toBe('Transport');
  });

  it('detects Accommodation category from "hotel"', () => {
    const result = parseVoiceInput('hotel 2000', MEMBERS);
    expect(result.type).toBe('expense');
    if (result.type !== 'expense') return;
    expect(result.category).toBe('Accommodation');
  });

  it('handles Hinglish "Auto 150 diya split with Rohan"', () => {
    const result = parseVoiceInput('Auto 150 diya split with Rohan', MEMBERS);
    expect(result.type).toBe('expense');
    if (result.type !== 'expense') return;
    expect(result.amount).toBe(150);
    expect(result.category).toBe('Transport');
  });

  it('handles comma-separated amounts in title "dinner, 1200"', () => {
    const result = parseVoiceInput('dinner, 1200 split with all', MEMBERS);
    expect(result.type).toBe('expense');
    if (result.type !== 'expense') return;
    expect(result.amount).toBe(1200);
  });
});

describe('voiceParser — Command Detection', () => {
  it('detects "undo last"', () => {
    const result = parseVoiceInput('undo last', MEMBERS);
    expect(result.type).toBe('command');
    if (result.type !== 'command') return;
    expect(result.command).toBe('undo');
  });

  it('detects "show QR"', () => {
    const result = parseVoiceInput('show QR', MEMBERS);
    expect(result.type).toBe('command');
    if (result.type !== 'command') return;
    expect(result.command).toBe('showQR');
  });

  it('detects "share on WhatsApp settlement"', () => {
    const result = parseVoiceInput('share on WhatsApp settlement', MEMBERS);
    expect(result.type).toBe('command');
    if (result.type !== 'command') return;
    expect(result.command).toBe('shareWhatsApp');
  });

  it('detects "read settlement"', () => {
    const result = parseVoiceInput('read settlement', MEMBERS);
    expect(result.type).toBe('command');
    if (result.type !== 'command') return;
    expect(result.command).toBe('readSettlement');
  });

  it('detects "help"', () => {
    const result = parseVoiceInput('help', MEMBERS);
    expect(result.type).toBe('command');
    if (result.type !== 'command') return;
    expect(result.command).toBe('help');
  });

  it('detects "switch to Ladakh trip"', () => {
    const result = parseVoiceInput('switch to Ladakh trip', MEMBERS);
    expect(result.type).toBe('command');
    if (result.type !== 'command') return;
    expect(result.command).toBe('switchTrip');
    expect(result.tripName).toContain('ladakh');
  });
});

describe('voiceParser — Query Detection', () => {
  it('detects "who owes what?"', () => {
    const result = parseVoiceInput('who owes what?', MEMBERS);
    expect(result.type).toBe('query');
    if (result.type !== 'query') return;
    expect(result.query).toBe('settle');
  });

  it('detects "how much did we spend today?"', () => {
    const result = parseVoiceInput('how much did we spend today?', MEMBERS);
    expect(result.type).toBe('query');
    if (result.type !== 'query') return;
    expect(result.query).toBe('totalToday');
  });

  it('detects "total expense"', () => {
    const result = parseVoiceInput('total expense', MEMBERS);
    expect(result.type).toBe('query');
    if (result.type !== 'query') return;
    expect(result.query).toBe('totalAll');
  });

  it('detects "how much did Rahul pay?"', () => {
    const result = parseVoiceInput('how much did Rahul pay?', MEMBERS);
    expect(result.type).toBe('query');
    if (result.type !== 'query') return;
    expect(result.query).toBe('howMuchPaid');
    expect(result.memberName).toBe('Rahul');
  });

  it('detects "kitna diya Rahul ne" (Hindi)', () => {
    const result = parseVoiceInput('Rahul ne kitna diya', MEMBERS);
    expect(result.type).toBe('query');
    if (result.type !== 'query') return;
    expect(result.query).toBe('howMuchPaid');
  });
});

describe('voiceParser — Fuzzy Member Matching', () => {
  it('matches "Rahul" exactly', () => {
    const result = parseVoiceInput('Rahul paid 500 split with all', MEMBERS);
    expect(result.type).toBe('expense');
    if (result.type !== 'expense') return;
    expect(result.payer).toBe('Rahul');
  });

  it('matches partial name "Amit" from "Amit ne diya 300"', () => {
    const result = parseVoiceInput('Amit ne diya 300', MEMBERS);
    expect(result.type).toBe('expense');
    if (result.type !== 'expense') return;
    expect(result.payer).toBe('Amit');
  });

  it('returns null for unrecognized member in payer', () => {
    const result = parseVoiceInput('paid by XYZ 500', MEMBERS);
    expect(result.type).toBe('expense');
    if (result.type !== 'expense') return;
    // XYZ not in member list → fallback to self
    expect(result.payer).toBe('__SELF__');
  });
});

describe('voiceParser — Edge Cases', () => {
  it('handles empty string', () => {
    const result = parseVoiceInput('', MEMBERS);
    expect(result.type).toBe('command');
    if (result.type === 'command') {
      expect(result.command).toBe('help');
    }
  });

  it('handles text with no amount as query', () => {
    const result = parseVoiceInput('recent expenses', MEMBERS);
    expect(result.type).toBe('query');
  });

  it('handles "₹1,200" with comma', () => {
    const result = parseVoiceInput('₹1,200 chai', MEMBERS);
    expect(result.type).toBe('expense');
    if (result.type !== 'expense') return;
    expect(result.amount).toBe(1200);
  });

  it('handles "99999.99 hotel"', () => {
    const result = parseVoiceInput('99999.99 hotel', MEMBERS);
    expect(result.type).toBe('expense');
    if (result.type !== 'expense') return;
    expect(result.amount).toBe(99999.99);
  });

  it('handles mix of Hindi + English "chai 30 diya"', () => {
    const result = parseVoiceInput('chai 30 diya', MEMBERS);
    expect(result.type).toBe('expense');
    if (result.type !== 'expense') return;
    expect(result.amount).toBe(30);
    expect(result.isPersonal).toBe(true);
  });
});
