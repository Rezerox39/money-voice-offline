// ─────────────────────────────────────────────────────────────────
// voiceParser.ts — Zero-dependency offline NLP parser
// Translates natural-language utterances into structured ledger
// entries, splits, queries, and terminal commands.
// ─────────────────────────────────────────────────────────────────

import { CATEGORIES } from '../types';

// ── Types ──────────────────────────────────────────────────────────

export interface ParsedExpense {
  type: 'expense';
  title: string;
  amount: number;
  payer: string | null; // null = "me" / current user
  splitMembers: string[]; // empty = "all", populated = selective
  splitMode: 'equal' | 'exact' | 'none';
  exactSplits: Record<string, number>; // for "Amit 400, me 200"
  category: string;
  isPersonal: boolean;
  raw: string;
}

export interface ParsedQuery {
  type: 'query';
  query: 'settle' | 'totalToday' | 'totalAll' | 'whoOwesWhat'
    | 'howMuchPaid' | 'recentExpenses' | 'memberTotal';
  memberName?: string;
  dateFilter?: 'today' | 'thisWeek' | 'thisMonth';
  raw: string;
}

export interface ParsedCommand {
  type: 'command';
  command: 'undo' | 'switchTrip' | 'showQR' | 'shareWhatsApp'
    | 'readSettlement' | 'help' | 'cancel';
  tripName?: string;
  raw: string;
}

export type ParsedUtterance = ParsedExpense | ParsedQuery | ParsedCommand;

// ── Helpers ────────────────────────────────────────────────────────

const AMOUNT_PATTERN = /(?:₹|rs\.?|inr)?\s*(\d[\d,]*\.?\d*)/i;

const MEMBER_ALIAS_MAP: Record<string, string> = {
  me: '__SELF__',
  i: '__SELF__',
  my: '__SELF__',
  myself: '__SELF__',
  mine: '__SELF__',
  mere: '__SELF__',
  mera: '__SELF__',
  meri: '__SELF__',
  'mujhe': '__SELF__',
  tu: '__SELF__',
  tere: '__SELF__',
};

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function matchAmount(text: string): number | null {
  // Try explicit ₹ prefix first, then bare number after keywords
  const explicitMatch = text.match(/(?:₹|rs\.?|inr)\s*(\d[\d,]*\.?\d*)/i);
  if (explicitMatch) {
    return parseFloat(explicitMatch[1].replace(/,/g, ''));
  }

  // After category/title keywords, the first number is the amount
  const afterKeyword = text.match(
    /(?:paid|spent|cost|bill|total|price|for|ka|ki|ke|diesel|petrol|chai|tea|coffee|lunch|dinner|breakfast|food|taxi|auto|hotel|cab|ride)\s+(?:₹|rs\.?|inr)?\s*(\d[\d,]*\.?\d*)/i
  );
  if (afterKeyword) {
    return parseFloat(afterKeyword[1].replace(/,/g, ''));
  }

  // Last resort: any standalone number (at least 2 digits or has decimal)
  const bareMatch = text.match(/(?:^|\s)(\d[\d,]*\.\d+|\d{2,})(?:\s|$)/);
  if (bareMatch) {
    return parseFloat(bareMatch[1].replace(/,/g, ''));
  }

  return null;
}

function detectCategory(title: string): string {
  const lower = title.toLowerCase();
  const categoryKeywords: Record<string, string[]> = {
    Food: ['food', 'dinner', 'lunch', 'breakfast', 'chai', 'tea', 'coffee', 'meal', 'snack', 'biryani', 'pizza', 'burger', 'momos', 'paratha', 'roti', 'dal', 'rice', 'dhaba', 'restaurant', 'cafe', 'eatery', 'khana', 'khaana', 'nashta'],
    Transport: ['taxi', 'cab', 'auto', 'uber', 'ola', 'petrol', 'diesel', 'fuel', 'bus', 'train', 'metro', 'flight', 'parking', 'toll', 'ride', 'bike', 'car', 'gaadi', 'sadak'],
    Accommodation: ['hotel', 'hostel', 'airbnb', 'room', 'stay', 'night', 'resort', 'camp', 'tent', 'lodge'],
    Shopping: ['shop', 'buy', 'bought', 'store', 'market', 'mart', 'offline', 'online', 'kharid', 'khareed'],
    Entertainment: ['movie', 'ticket', 'show', 'concert', 'game', 'party', 'bar', 'club', 'pub', 'disc'],
    Utilities: ['electricity', 'water', 'wifi', 'internet', 'recharge', 'bill', 'phone', 'mobile'],
  };

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return category;
    }
  }
  return 'Other';
}

function extractTitle(text: string, amount: number | null): string {
  let cleaned = text;

  // Remove amount patterns
  cleaned = cleaned.replace(/₹\s*\d[\d,]*\.?\d*/gi, '');
  cleaned = cleaned.replace(/rs\.?\s*\d[\d,]*\.?\d*/gi, '');
  cleaned = cleaned.replace(/inr\s*\d[\d,]*\.?\d*/gi, '');

  // Remove command words
  cleaned = cleaned.replace(
    /\b(paid|pay|split|between|with|and|me|my|i|for|the|a|an|to|was|did|had|all|everyone|each|card|cash|online|upi)\b/gi,
    ''
  );

  // Remove payer/split declarations
  cleaned = cleaned.replace(/\b(paid by|payer|owes?|give|dene|diya|dile|dya)\b/gi, '');

  // Remove split markers
  cleaned = cleaned.replace(/\b(split|share|divide|half)\b/gi, '');

  // Remove remaining bare numbers (amounts already extracted)
  cleaned = cleaned.replace(/\b\d[\d,]*\.?\d*\b/g, '');

  // Clean up
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // If what's left is just a word or two, use it as title
  if (cleaned.length > 0 && cleaned.length < 40) {
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  // Fallback
  return 'Expense';
}

function parseSplitMembers(
  text: string,
  memberNames: string[]
): { members: string[]; exactSplits: Record<string, number> } {
  const lower = text.toLowerCase();
  const members: string[] = [];
  const exactSplits: Record<string, number> = {};

  // Check for exact splits: "Amit 400, me 200"
  const exactPattern = /(\w+)\s+(?:₹|rs)?\s*(\d[\d,]*\.?\d*)/g;
  let exactMatch;
  const potentialExact: Array<{ name: string; amount: number }> = [];

  while ((exactMatch = exactPattern.exec(text)) !== null) {
    const name = exactMatch[1];
    const amt = parseFloat(exactMatch[2].replace(/,/g, ''));
    const matchedMember = findMember(name, memberNames);
    if (matchedMember && amt > 0) {
      potentialExact.push({ name: matchedMember, amount: amt });
    }
  }

  // If we found multiple exact amounts, treat as exact split
  if (potentialExact.length >= 2) {
    for (const p of potentialExact) {
      exactSplits[p.name] = p.amount;
      if (!members.includes(p.name)) members.push(p.name);
    }
    return { members, exactSplits };
  }

  // Check for "split with/between X, Y, Z"
  const splitMatch = text.match(
    /\b(?:split|share|divide)\s+(?:with|between)\s+(.+?)(?:\s*$|\s*and\s*$)/i
  );
  if (splitMatch) {
    const namesStr = splitMatch[1];
    const names = namesStr.split(/,|\s+and\s+|\s+&\s+/).map((s) => s.trim());
    for (const name of names) {
      if (name) {
        const resolved = MEMBER_ALIAS_MAP[name.toLowerCase()] || findMember(name, memberNames);
        if (resolved) members.push(resolved);
      }
    }
    return { members, exactSplits };
  }

  // Check for "paid by X"
  const paidByMatch = text.match(/\b(?:paid by|payer|from)\s+(\w+)/i);
  if (paidByMatch) {
    // Don't add payer to split list unless explicitly mentioned
  }

  // If "all" or "everyone" or "each" mentioned → empty = all
  if (/\b(all|everyone|each|sab|sabhi)\b/i.test(text)) {
    return { members: [], exactSplits };
  }

  return { members, exactSplits };
}

function findMember(name: string, memberNames: string[]): string | null {
  const lower = name.toLowerCase();

  // Check alias map first
  if (MEMBER_ALIAS_MAP[lower]) return MEMBER_ALIAS_MAP[lower];

  // Exact match
  for (const m of memberNames) {
    if (m.toLowerCase() === lower) return m;
  }

  // Partial / starts-with match
  for (const m of memberNames) {
    if (m.toLowerCase().startsWith(lower) || lower.startsWith(m.toLowerCase())) {
      return m;
    }
  }

  // Fuzzy: if the spoken name is within 1 char of a member name
  for (const m of memberNames) {
    if (levenshteinDistance(lower, m.toLowerCase()) <= 1 && lower.length >= 3) {
      return m;
    }
  }

  return null;
}

function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[b.length][a.length];
}

function detectPayer(
  text: string,
  memberNames: string[]
): string | null {
  const lower = text.toLowerCase();

  // Explicit "paid by X"
  const paidByMatch = text.match(/\b(?:paid by|payer|from)\s+(\w+)/i);
  if (paidByMatch) {
    const name = paidByMatch[1];
    const resolved = findMember(name, memberNames);
    if (resolved) return resolved;
  }

  // "X paid" or "X ne diya" at start
  const startPaidMatch = text.match(/^(\w+)\s+(?:paid|ne\s+diya|diya|dile|dya)/i);
  if (startPaidMatch) {
    const name = startPaidMatch[1];
    const resolved = findMember(name, memberNames);
    if (resolved) return resolved;
  }

  // "X ne kitna diya" pattern
  const neDiyaMatch = text.match(/(\w+)\s+ne\s+(?:kitna\s+)?diya/i);
  if (neDiyaMatch) {
    const resolved = findMember(neDiyaMatch[1], memberNames);
    if (resolved) return resolved;
  }

  // "Rahul ka" / "Rahul ki" — Hindi possession = payer
  const possMatch = text.match(/(\w+)\s+(?:ka|ki|ke)\s+(?:bill|kharcha| paisa)/i);
  if (possMatch) {
    const resolved = findMember(possMatch[1], memberNames);
    if (resolved) return resolved;
  }

  // Default: me / self
  return '__SELF__';
}

// ── Command Detection ──────────────────────────────────────────────

function detectCommand(text: string): ParsedCommand | null {
  const lower = text.toLowerCase().trim();

  const commandPatterns: Array<{
    pattern: RegExp;
    command: ParsedCommand['command'];
    tripNameExtract?: RegExp;
  }> = [
    { pattern: /\b(undo|cancel last|remove last|delete last)\b/i, command: 'undo' },
    {
      pattern: /\b(?:switch|go to|change to|open)\s+(?:to\s+)?(?:trip|channel)\s+(.+)/i,
      command: 'switchTrip',
      tripNameExtract: /(?:trip|channel)\s+(.+)/i,
    },
    {
      pattern: /\b(?:switch|go to|change to)\s+to\s+(.+)/i,
      command: 'switchTrip',
      tripNameExtract: /(?:to)\s+(.+)/i,
    },
    { pattern: /\b(?:show\s+qr|sync|show\s+code|generate\s+qr)\b/i, command: 'showQR' },
    {
      pattern: /\b(?:share|send|whatsapp|message)\s+(?:on\s+)?(?:whatsapp)?\s*(?:settle|summary|breakdown)/i,
      command: 'shareWhatsApp',
    },
    {
      pattern: /\b(?:read|speak|tell|suno)\s+(?:settle|settlement|summary|breakdown|all)\b/i,
      command: 'readSettlement',
    },
    { pattern: /\b(help|commands|what can you do|kya kar sakta)\b/i, command: 'help' },
    { pattern: /\b(cancel|stop|ruk|mat karo)\b/i, command: 'cancel' },
  ];

  for (const { pattern, command, tripNameExtract } of commandPatterns) {
    if (pattern.test(lower)) {
      let tripName: string | undefined;
      if (tripNameExtract) {
        const match = lower.match(tripNameExtract);
        if (match) tripName = match[1].trim();
      }
      return { type: 'command', command, tripName, raw: text };
    }
  }

  return null;
}

// ── Query Detection ────────────────────────────────────────────────

function detectQuery(text: string): ParsedQuery | null {
  const lower = text.toLowerCase().trim();

  // Settlement query (but not "read settlement" which is a command)
  if (/(?:who\s+(?:owes?|pays?)\s+what|kitna\s+baki|hisab\s+kitab)/i.test(lower) ||
      (/(?:settle|settlement|balance)\b/i.test(lower) && !/\bread\b/i.test(lower))) {
    return { type: 'query', query: 'settle', raw: text };
  }

  // Total today
  if (/\b(?:how\s+much|kitna|total|spend|spent)\b.*\b(today|aaj|aaj ka)\b/i.test(lower)) {
    return { type: 'query', query: 'totalToday', dateFilter: 'today', raw: text };
  }

  // Total all time
  if (/\b(?:total|total\s+expense|total\s+spend|total\s+spent|kitna\s+kharcha|total\s+karcha)\b/i.test(lower)) {
    return { type: 'query', query: 'totalAll', raw: text };
  }

  // Who owes what (same as settle but different phrasing)
  if (/\b(?:who\s+owes|kisko\s+dena|kisko\s+dena\s+hai|who\s+should\s+pay)\b/i.test(lower)) {
    return { type: 'query', query: 'whoOwesWhat', raw: text };
  }

  // How much did X pay — capture member name with original casing
  const howMuchPaid = lower.match(
    /\b(?:how\s+much|kitna|total)\b.*\b(?:did|ne|ka)\s+(\w+)\s+(?:pay|pay|diya|dya|contribute|dene)\b/i
  );
  if (howMuchPaid) {
    // Extract member name with original casing from the original text
    const nameMatch = text.match(
      /\b(?:how\s+much|kitna|total)\b.*\b(?:did|ne|ka)\s+(\w+)\s+(?:pay|pay|diya|dya|contribute|dene)\b/i
    );
    const memberName = nameMatch ? nameMatch[1] : howMuchPaid[1];
    return { type: 'query', query: 'howMuchPaid', memberName, raw: text };
  }

  // Alternate: "Rahul ne kitna diya" — capture with original casing
  const altPaid = lower.match(/(\w+)\s+(?:ne\s+)?(?:kitna|how\s+much)\s+(?:diya|dya|paid|pay|contribute)/i);
  if (altPaid) {
    const altPaidOriginal = text.match(/(\w+)\s+(?:ne\s+)?(?:kitna|how\s+much)\s+(?:diya|dya|paid|pay|contribute)/i);
    const memberName = altPaidOriginal ? altPaidOriginal[1] : altPaid[1];
    return { type: 'query', query: 'howMuchPaid', memberName, raw: text };
  }

  // "switch" is a command, not a query — skip if starts with switch
  if (/\bswitch\b/i.test(lower)) return null;

  // Recent expenses
  if (/\b(?:recent|last|pichla|abhi)\s+(?:expense|entry|transaction|kharcha)\b/i.test(lower)) {
    return { type: 'query', query: 'recentExpenses', raw: text };
  }

  return null;
}

// ── Main Parser ────────────────────────────────────────────────────

export function parseVoiceInput(
  text: string,
  memberNames: string[] = []
): ParsedUtterance {
  const trimmed = text.trim();
  if (!trimmed) {
    return { type: 'command', command: 'help', raw: text };
  }

  // 1. Check for explicit commands first
  const command = detectCommand(trimmed);
  if (command) return command;

  // 2. Check for queries
  const query = detectQuery(trimmed);
  if (query) return query;

  // 3. Try to parse as expense
  const amount = matchAmount(trimmed);
  if (amount === null || amount <= 0) {
    // No amount found — could be a query or unrecognized
    return {
      type: 'query',
      query: 'recentExpenses',
      raw: trimmed,
    };
  }

  // Extract title
  const title = extractTitle(trimmed, amount);

  // Extract payer
  const payer = detectPayer(trimmed, memberNames);

  // Extract split info
  const { members: splitMembers, exactSplits } = parseSplitMembers(trimmed, memberNames);

  // Determine if personal (no group members mentioned / no split keyword)
  const hasSplitKeyword = /\b(split|share|divide|between|with|sab|all|everyone|each)\b/i.test(
    trimmed
  );
  const hasSpecificMembers = splitMembers.length > 0 || Object.keys(exactSplits).length > 0;
  const isPersonal = !hasSplitKeyword && !hasSpecificMembers;

  // Determine split mode
  let splitMode: ParsedExpense['splitMode'] = 'equal';
  if (Object.keys(exactSplits).length >= 2) {
    splitMode = 'exact';
  } else if (isPersonal) {
    splitMode = 'none';
  }

  // Category
  const category = detectCategory(trimmed);

  return {
    type: 'expense',
    title,
    amount,
    payer,
    splitMembers,
    splitMode,
    exactSplits,
    category,
    isPersonal,
    raw: trimmed,
  };
}

// ── Formatting helpers (for terminal display) ──────────────────────

export function formatParsedCommand(cmd: ParsedCommand): string {
  switch (cmd.command) {
    case 'undo': return '↩ UNDO LAST ENTRY';
    case 'switchTrip': return `→ SWITCH TRIP: ${cmd.tripName ?? '???'}`;
    case 'showQR': return '📱 SHOW SYNC QR';
    case 'shareWhatsApp': return '💬 SHARE ON WHATSAPP';
    case 'readSettlement': return '🔊 READ SETTLEMENT ALOUD';
    case 'help': return '❓ HELP — LIST COMMANDS';
    case 'cancel': return '✕ CANCEL';
  }
}

export function formatParsedQuery(q: ParsedQuery): string {
  switch (q.query) {
    case 'settle': return '💰 WHO OWES WHAT?';
    case 'totalToday': return '📅 TODAY\'S TOTAL';
    case 'totalAll': return '📊 ALL-TIME TOTAL';
    case 'whoOwesWhat': return '💰 SETTLEMENT MATRIX';
    case 'howMuchPaid': return `💰 ${q.memberName?.toUpperCase() ?? '???'}'S CONTRIBUTIONS`;
    case 'recentExpenses': return '📋 RECENT ENTRIES';
    case 'memberTotal': return `👤 ${q.memberName?.toUpperCase() ?? '???'} TOTAL`;
  }
}

export function formatParsedExpense(
  exp: ParsedExpense,
  memberNames: string[]
): string {
  const payerDisplay = exp.payer === '__SELF__' ? 'YOU' : (exp.payer ?? 'YOU').toUpperCase();

  let splitDisplay: string;
  if (exp.splitMode === 'none') {
    splitDisplay = 'PERSONAL';
  } else if (exp.splitMode === 'exact') {
    const entries = Object.entries(exp.exactSplits)
      .map(([name, amt]) => `${name.toUpperCase()}=${amt}`)
      .join(', ');
    splitDisplay = entries;
  } else if (exp.splitMembers.length === 0) {
    splitDisplay = `ALL (${memberNames.length})`;
  } else {
    splitDisplay = exp.splitMembers.map((m) => m === '__SELF__' ? 'YOU' : m.toUpperCase()).join(' + ');
  }

  return `[EXPENSE] ${exp.title.toUpperCase()}: ₹${exp.amount.toLocaleString('en-IN')} | PAID: ${payerDisplay} | SPLIT: ${splitDisplay} | ${exp.category.toUpperCase()}`;
}
