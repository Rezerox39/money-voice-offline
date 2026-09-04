// ─────────────────────────────────────────────────────────────────
// voiceParser.ts — Hardened offline NLP parser
// No greedy wildcards. Deterministic tokenization.
// Supports pool/kitty, leader fallback, amount disambiguation.
// ─────────────────────────────────────────────────────────────────

import { CATEGORIES } from '../types';

// ── Types ──────────────────────────────────────────────────────────

export type ParsedIntent =
  | 'ADD_EXPENSE' | 'POOL_DEPOSIT' | 'POOL_WITHDRAW'
  | 'QUERY_SETTLEMENT' | 'QUERY_TOTAL' | 'QUERY_MEMBER'
  | 'COMMAND_UNDO' | 'COMMAND_SWITCH' | 'COMMAND_QR'
  | 'COMMAND_WHATSAPP' | 'COMMAND_READ_SETTLEMENT'
  | 'COMMAND_HELP' | 'COMMAND_CANCEL';

export interface ParsedExpense {
  type: 'expense'; intent: 'ADD_EXPENSE'; title: string; amount: number;
  payer: string | null; splitMembers: string[]; splitMode: 'equal' | 'exact' | 'none';
  exactSplits: Record<string, number>; category: string; isPersonal: boolean;
  isPool: boolean; raw: string;
}

export interface ParsedPoolDeposit {
  type: 'pool'; intent: 'POOL_DEPOSIT'; amount: number; payerId: string | null; raw: string;
}

export interface ParsedPoolWithdraw {
  type: 'pool'; intent: 'POOL_WITHDRAW'; amount: number; title: string; raw: string;
}

export interface ParsedQuery {
  type: 'query'; intent: 'QUERY_SETTLEMENT' | 'QUERY_TOTAL' | 'QUERY_MEMBER';
  memberName?: string; raw: string;
}

export interface ParsedCommand {
  type: 'command'; intent: ParsedCommand_Intent; tripName?: string; raw: string;
}

type ParsedCommand_Intent =
  | 'COMMAND_UNDO' | 'COMMAND_SWITCH' | 'COMMAND_QR' | 'COMMAND_WHATSAPP'
  | 'COMMAND_READ_SETTLEMENT' | 'COMMAND_HELP' | 'COMMAND_CANCEL';

export type ParseResult = ParsedExpense | ParsedPoolDeposit | ParsedPoolWithdraw | ParsedQuery | ParsedCommand;
export type ParsedUtterance = ParseResult;

// ── Self aliases ───────────────────────────────────────────────────

const SELF_ALIASES = new Set([
  'me', 'i', 'my', 'myself', 'mine',
  'mere', 'mera', 'meri', 'mujhe', 'hum',
  'tu', 'tere', 'teri', 'tera',
]);

// ── Amount Disambiguation ──────────────────────────────────────────
// Strategy: detect comma-separated split sections. If found, the first
// bare number in the title section is the total amount. Otherwise, the
// rightmost bare number is the amount (item counts are leftmost).

const CURRENCY_PATTERN = /(?:₹|rs\.?|inr)\s*(\d[\d,]*\.?\d*)/i;

// Keywords whose trailing number is the monetary amount
// NOTE: "room" is excluded — "Room 302" is a title, not an amount keyword
const AMOUNT_KEYWORDS =
  '(?:paid|spent|cost|bill|total|price|rent|fare|charge|fee|book|recharge|diesel|petrol|chai|tea|coffee|lunch|dinner|breakfast|food|taxi|auto|hotel|cab|ride|fuel|toll|parking|ticket|entry)';

const POOL_KEYWORDS = /\b(?:pool|kitty|common\s*cash|fund|communal)\b/i;
const FROM_POOL = /\bfrom\s+(?:the\s+)?(?:pool|kitty|fund|common\s*cash)\b/i;
const ADD_TO_POOL = /\b(?:add|put|deposit|drop)\s+\d[\d,]*\.?\d*\s+(?:to|into)\s+(?:the\s+)?(?:pool|kitty|fund|common\s*cash)\b/i;

function extractAmount(text: string): number | null {
  // P1: Explicit currency prefix
  const currencyMatch = text.match(CURRENCY_PATTERN);
  if (currencyMatch) return parseFloat(currencyMatch[1].replace(/,/g, ''));

  // P2: Number after a known spend keyword (but not if preceded by another word — item count)
  const kwPattern = new RegExp('(?<![\\w])' + AMOUNT_KEYWORDS + '\\s+(\\d[\\d,]*\\.?\\d*)', 'i');
  const kwMatch = text.match(kwPattern);
  if (kwMatch) return parseFloat(kwMatch[1].replace(/,/g, ''));

  // P3: Comma-separated split section detected
  // "Lunch 600, Amit 400, me 200" → total = 600 (first bare number before comma)
  const hasSplitSection = text.includes(',') || /\bsplit\b/i.test(text);
  if (hasSplitSection) {
    const beforeSplit = text.split(/,/)[0]; // Everything before first comma
    const tokens = beforeSplit.split(/\s+/);
    for (const token of tokens) {
      const cleaned = token.replace(/[,$]/g, '');
      const num = parseFloat(cleaned);
      if (!isNaN(num) && num > 0 && !CURRENCY_PATTERN.test(token)) {
        return num;
      }
    }
  }

  // P4: Rightmost bare number = monetary amount (item counts are leftmost)
  const tokens = text.split(/\s+/);
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i].replace(/[,$]/g, '');
    const num = parseFloat(token);
    if (isNaN(num) || num <= 0) continue;
    if (CURRENCY_PATTERN.test(tokens[i])) continue;
    return num;
  }
  return null;
}

// ── Title Extraction ───────────────────────────────────────────────

const NOISE_WORDS = new Set([
  'paid', 'pay', 'by', 'split', 'between', 'with', 'and', 'me', 'my', 'i',
  'for', 'the', 'a', 'an', 'to', 'was', 'did', 'had', 'all', 'everyone',
  'each', 'card', 'cash', 'online', 'upi', 'from', 'pool', 'kitty',
  'fund', 'personal', 'private', 'own', 'add', 'put', 'deposit',
  'rupees', 'bucks', 'rs', 'inr',
]);

function extractTitle(text: string, amount: number | null): string {
  let cleaned = text;
  // Remove currency-prefixed amounts
  cleaned = cleaned.replace(/(?:₹|rs\.?|inr)\s*\d[\d,]*\.?\d*/gi, '');
  // Remove the monetary amount (but keep item counts like "2" in "2 plates maggi")
  if (amount !== null) {
    const amountStr = amount.toString().replace('.', '\\.');
    cleaned = cleaned.replace(new RegExp('\\b' + amountStr + '\\b', 'g'), '');
    const commaFormatted = amount.toLocaleString('en-IN');
    if (commaFormatted !== amount.toString()) {
      cleaned = cleaned.replace(new RegExp(commaFormatted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
    }
  }
  // Remove remaining standalone numbers that are NOT item counts
  // Keep single-digit numbers that precede a word (item counts: "2 plates")
  // NOTE: do NOT strip multi-digit numbers — 'Room 302 rent' needs '302' preserved
  // Remove structural patterns FIRST (before noise words remove their anchors)
  cleaned = cleaned.replace(/\bpaid\s+by\s+[\w\s]+?(?=\s+(?:split|and|,|$))/gi, '');
  cleaned = cleaned.replace(/\bsplit\s+[\w\s,and]+/gi, '');
  cleaned = cleaned.replace(/\bbetween\s+[\w\s,and]+/gi, '');
  // Remove noise words
  cleaned = cleaned.replace(new RegExp('\\b(?:' + Array.from(NOISE_WORDS).join('|') + ')\\b', 'gi'), '');
  cleaned = cleaned.replace(/[,;:!?.]/g, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  if (cleaned.length === 0) return 'Expense';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

// ── Category Detection ─────────────────────────────────────────────

function detectCategory(title: string): string {
  const lower = title.toLowerCase();
  const map: Record<string, string[]> = {
    Food: ['food', 'dinner', 'lunch', 'breakfast', 'chai', 'tea', 'coffee', 'meal', 'snack', 'biryani', 'pizza', 'burger', 'momos', 'paratha', 'roti', 'dal', 'rice', 'dhaba', 'restaurant', 'cafe', 'maggi', 'noodles', 'thali', 'paneer', 'naan', 'samosa'],
    Transport: ['taxi', 'cab', 'auto', 'uber', 'ola', 'petrol', 'diesel', 'fuel', 'bus', 'train', 'metro', 'flight', 'parking', 'toll', 'ride', 'bike', 'car', 'rickshaw'],
    Accommodation: ['hotel', 'hostel', 'airbnb', 'room', 'stay', 'night', 'resort', 'camp', 'tent', 'lodge', 'rent', 'pg', 'flat'],
    Shopping: ['shop', 'buy', 'bought', 'store', 'market', 'mart', 'clothes', 'shoes', 'bag'],
    Entertainment: ['movie', 'ticket', 'show', 'concert', 'game', 'party', 'bar', 'club', 'pub', 'entry'],
    Utilities: ['electricity', 'water', 'wifi', 'internet', 'recharge', 'bill', 'phone', 'mobile', 'sim'],
  };
  for (const [cat, kws] of Object.entries(map)) {
    if (kws.some((kw) => lower.includes(kw))) return cat;
  }
  return 'Other';
}

// ── Fuzzy Member Matching ──────────────────────────────────────────

function fuzzyMatchMember(input: string, memberNames: string[]): string | null {
  const lower = input.toLowerCase().trim();
  if (SELF_ALIASES.has(lower)) return '__SELF__';
  for (const m of memberNames) {
    if (m.toLowerCase() === lower) return m;
  }
  for (const m of memberNames) {
    if (m.toLowerCase().startsWith(lower) && lower.length >= 3) return m;
    if (lower.startsWith(m.toLowerCase()) && m.length >= 3) return m;
  }
  for (const m of memberNames) {
    if (m.length >= 3 && lower.length >= 3 && levenshteinDistance(lower, m.toLowerCase()) <= 1) return m;
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
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return matrix[b.length][a.length];
}

// ── Payer Detection ────────────────────────────────────────────────

function detectPayer(text: string, memberNames: string[], leaderId: string | null): string | null {
  const paidByMatch = text.match(/\bpaid\s+by\s+(\w[\w\s]*?)(?:\s+(?:split|and|,|$))/i);
  if (paidByMatch) {
    const resolved = fuzzyMatchMember(paidByMatch[1].trim(), memberNames);
    if (resolved) return resolved;
  }
  const startPaidMatch = text.match(/^(\w+)\s+(?:paid|ne\s+diya|diya|dile|dya)/i);
  if (startPaidMatch) {
    const resolved = fuzzyMatchMember(startPaidMatch[1], memberNames);
    if (resolved) return resolved;
  }
  const neDiyaMatch = text.match(/(\w+)\s+ne\s+(?:\w+\s+)?diya/i);
  if (neDiyaMatch) {
    const resolved = fuzzyMatchMember(neDiyaMatch[1], memberNames);
    if (resolved) return resolved;
  }
  const possMatch = text.match(/(\w+)\s+(?:ka|ki|ke)\s+(?:bill|kharcha|paisa|taraf|side)/i);
  if (possMatch) {
    const resolved = fuzzyMatchMember(possMatch[1], memberNames);
    if (resolved) return resolved;
  }
  return leaderId ?? '__SELF__';
}

// ── Split Detection ────────────────────────────────────────────────

function parseSplitMembers(text: string, memberNames: string[]): { members: string[]; exactSplits: Record<string, number> } {
  const members: string[] = [];
  const exactSplits: Record<string, number> = {};

  // Exact splits: comma-separated "Name Amount" pairs after first comma
  const hasComma = text.includes(',');
  if (hasComma) {
    const afterFirstComma = text.substring(text.indexOf(',') + 1);
    const exactPattern = /(\w+)\s+(\d[\d,]*\.?\d*)/g;
    let m;
    const pairs: Array<{ name: string; amount: number }> = [];
    while ((m = exactPattern.exec(afterFirstComma)) !== null) {
      const name = m[1];
      const amt = parseFloat(m[2].replace(/,/g, ''));
      const resolved = fuzzyMatchMember(name, memberNames);
      if (resolved && amt > 0) pairs.push({ name: resolved, amount: amt });
    }
    if (pairs.length >= 2) {
      for (const p of pairs) {
        exactSplits[p.name] = p.amount;
        if (!members.includes(p.name)) members.push(p.name);
      }
      return { members, exactSplits };
    }
  }

  // "split X and Y"
  const splitMatch = text.match(/\bsplit\s+([\w\s,and&,]+?)(?:\s*$|\s+(?:with|from|paid))/i);
  if (splitMatch) {
    const names = splitMatch[1].split(/,|\s+and\s+|\s*&\s+/).map((s) => s.trim());
    for (const name of names) {
      if (name.length === 0) continue;
      if (SELF_ALIASES.has(name.toLowerCase())) { members.push('__SELF__'); continue; }
      const resolved = fuzzyMatchMember(name, memberNames);
      if (resolved) members.push(resolved);
    }
    return { members, exactSplits };
  }

  // "between X and Y"
  const betweenMatch = text.match(/\bbetween\s+([\w\s,and&,]+?)(?:\s*$|\s+(?:with|from|paid))/i);
  if (betweenMatch) {
    const names = betweenMatch[1].split(/,|\s+and\s+|\s*&\s+/).map((s) => s.trim());
    for (const name of names) {
      if (name.length === 0) continue;
      if (SELF_ALIASES.has(name.toLowerCase())) { members.push('__SELF__'); continue; }
      const resolved = fuzzyMatchMember(name, memberNames);
      if (resolved) members.push(resolved);
    }
    return { members, exactSplits };
  }

  if (/\b(?:all|everyone|each|sab|sabhi)\b/i.test(text)) {
    return { members: [], exactSplits };
  }

  return { members, exactSplits };
}

// ── Command Detection ──────────────────────────────────────────────

function detectCommand(text: string): ParsedCommand | null {
  const lower = text.toLowerCase().trim();
  const patterns: Array<{ pattern: RegExp; intent: ParsedCommand_Intent }> = [
    { pattern: /\b(?:undo|cancel\s+last|remove\s+last|delete\s+last)\b/i, intent: 'COMMAND_UNDO' },
    { pattern: /\b(?:show\s+qr|sync|show\s+code|generate\s+qr)\b/i, intent: 'COMMAND_QR' },
    { pattern: /\b(?:share|send|whatsapp)\s+(?:on\s+)?(?:whatsapp)?\s*(?:settle|summary|breakdown)?/i, intent: 'COMMAND_WHATSAPP' },
    { pattern: /\b(?:read|speak|tell|suno)\s+(?:settle|settlement|summary|breakdown|all)\b/i, intent: 'COMMAND_READ_SETTLEMENT' },
    { pattern: /\b(?:help|commands|what\s+can\s+you\s+do|kya\s+kar\s+sakta)\b/i, intent: 'COMMAND_HELP' },
    { pattern: /\b(?:cancel|stop|ruk|mat\s+karo)\b/i, intent: 'COMMAND_CANCEL' },
  ];
  for (const { pattern, intent } of patterns) {
    if (pattern.test(lower)) {
      let tripName: string | undefined;
      if (intent === 'COMMAND_SWITCH') {
        const m = lower.match(/(?:switch|go\s+to|change\s+to)\s+(?:to\s+)?(?:trip\s+)?(.+)/);
        if (m) tripName = m[1].trim();
      }
      return { type: 'command', intent, tripName, raw: text };
    }
  }
  const switchMatch = lower.match(/\b(?:switch|go\s+to|change\s+to|open)\s+(?:to\s+)?(?:trip\s+)?(.+)/);
  if (switchMatch) {
    return { type: 'command', intent: 'COMMAND_SWITCH', tripName: switchMatch[1].trim(), raw: text };
  }
  return null;
}

// ── Query Detection ────────────────────────────────────────────────

function detectQuery(text: string): ParsedQuery | null {
  const lower = text.toLowerCase().trim();
  if (/\b(?:who\s+owes?\s+what|settle|settlement|balance|kitna\s+baki|hisab\s+kitab)\b/i.test(lower)) {
    return { type: 'query', intent: 'QUERY_SETTLEMENT', raw: text };
  }
  if (/\b(?:total|how\s+much\s+(?:did\s+we\s+)?(?:spend|spent|kharcha))\b/i.test(lower)) {
    return { type: 'query', intent: 'QUERY_TOTAL', raw: text };
  }
  const howMuchPaid = lower.match(/\b(?:how\s+much|kitna)\b.*?\b(?:did|ne|ka)\s+(\w+)\s+(?:pay|diya|dya|contribute|dene)\b/i);
  if (howMuchPaid) {
    const nameMatch = text.match(/\b(?:how\s+much|kitna)\b.*?\b(?:did|ne|ka)\s+(\w+)\s+(?:pay|diya|dya|contribute|dene)\b/i);
    return { type: 'query', intent: 'QUERY_MEMBER', memberName: nameMatch ? nameMatch[1] : howMuchPaid[1], raw: text };
  }
  const altPaid = lower.match(/(\w+)\s+ne\s+(?:\w+\s+)?(?:kitna|how\s+much)\s+(?:diya|dya|paid|pay|contribute)/i);
  if (altPaid) {
    const altOriginal = text.match(/(\w+)\s+ne\s+(?:\w+\s+)?(?:kitna|how\s+much)\s+(?:diya|dya|paid|pay|contribute)/i);
    return { type: 'query', intent: 'QUERY_MEMBER', memberName: altOriginal ? altOriginal[1] : altPaid[1], raw: text };
  }
  return null;
}

// ── Main Parser ────────────────────────────────────────────────────

export interface ParseOptions {
  memberNames?: string[];
  leaderId?: string | null;
  currentUserId?: string;
}

export function parseVoiceInput(
  text: string,
  memberNamesOrOptions: string[] | ParseOptions = []
): ParseResult {
  const trimmed = text.trim();
  if (!trimmed) return { type: 'command', intent: 'COMMAND_HELP', raw: text };

  let memberNames: string[];
  let leaderId: string | null;
  let currentUserId: string;
  if (Array.isArray(memberNamesOrOptions)) {
    memberNames = memberNamesOrOptions;
    leaderId = null;
    currentUserId = '__SELF__';
  } else {
    memberNames = memberNamesOrOptions.memberNames ?? [];
    leaderId = memberNamesOrOptions.leaderId ?? null;
    currentUserId = memberNamesOrOptions.currentUserId ?? '__SELF__';
  }

  const command = detectCommand(trimmed);
  if (command) return command;

  const query = detectQuery(trimmed);
  if (query) return query;

  if (ADD_TO_POOL.test(trimmed)) {
    const amount = extractAmount(trimmed);
    if (amount !== null && amount > 0) {
      const fromMatch = trimmed.match(/\bfrom\s+(\w[\w\s]*?)(?:\s*$)/i);
      let payerId: string | null = null;
      if (fromMatch) payerId = fuzzyMatchMember(fromMatch[1].trim(), memberNames);
      return { type: 'pool', intent: 'POOL_DEPOSIT', amount, payerId: payerId ?? currentUserId, raw: trimmed };
    }
  }

  if (FROM_POOL.test(trimmed)) {
    const amount = extractAmount(trimmed);
    if (amount !== null && amount > 0) {
      const title = extractTitle(trimmed, amount);
      return { type: 'pool', intent: 'POOL_WITHDRAW', amount, title, raw: trimmed };
    }
  }

  const amount = extractAmount(trimmed);
  if (amount === null || amount <= 0) {
    return { type: 'query', intent: 'QUERY_TOTAL', raw: trimmed };
  }

  const title = extractTitle(trimmed, amount);
  const payer = detectPayer(trimmed, memberNames, leaderId);
  const { members: splitMembers, exactSplits } = parseSplitMembers(trimmed, memberNames);

  const isPool = POOL_KEYWORDS.test(trimmed) || FROM_POOL.test(trimmed);
  const hasSplitKeyword = /\b(?:split|share|divide|between|with|sab|all|everyone|each)\b/i.test(trimmed);
  const hasSpecificMembers = splitMembers.length > 0 || Object.keys(exactSplits).length > 0;
  const isPersonal =
    trimmed.toLowerCase().includes('personal') ||
    trimmed.toLowerCase().includes('private') ||
    trimmed.toLowerCase().includes('own') ||
    (!hasSplitKeyword && !hasSpecificMembers && !isPool);

  let splitMode: ParsedExpense['splitMode'] = 'equal';
  if (Object.keys(exactSplits).length >= 2) splitMode = 'exact';
  else if (isPersonal) splitMode = 'none';

  return {
    type: 'expense', intent: 'ADD_EXPENSE', title, amount, payer,
    splitMembers, splitMode, exactSplits, category: detectCategory(trimmed),
    isPersonal, isPool, raw: trimmed,
  };
}

// ── Formatting helpers ─────────────────────────────────────────────

export function formatParsedCommand(cmd: ParsedCommand): string {
  switch (cmd.intent) {
    case 'COMMAND_UNDO': return '↩ UNDO LAST ENTRY';
    case 'COMMAND_SWITCH': return `→ SWITCH TRIP: ${cmd.tripName ?? '???'}`;
    case 'COMMAND_QR': return '📱 SHOW SYNC QR';
    case 'COMMAND_WHATSAPP': return '💬 SHARE ON WHATSAPP';
    case 'COMMAND_READ_SETTLEMENT': return '🔊 READ SETTLEMENT ALOUD';
    case 'COMMAND_HELP': return '❓ HELP — LIST COMMANDS';
    case 'COMMAND_CANCEL': return '✕ CANCEL';
  }
}

export function formatParsedQuery(q: ParsedQuery): string {
  switch (q.intent) {
    case 'QUERY_SETTLEMENT': return '💰 WHO OWES WHAT?';
    case 'QUERY_TOTAL': return '📊 TOTAL EXPENSES';
    case 'QUERY_MEMBER': return `💰 ${q.memberName?.toUpperCase() ?? '???'}'S CONTRIBUTIONS`;
  }
}

export function formatParsedExpense(exp: ParsedExpense, memberNames: string[]): string {
  const payerDisplay = exp.payer === '__SELF__' ? 'YOU' : (exp.payer ?? 'YOU').toUpperCase();
  let splitDisplay: string;
  if (exp.isPool) splitDisplay = 'POOL';
  else if (exp.splitMode === 'none') splitDisplay = 'PERSONAL';
  else if (exp.splitMode === 'exact') {
    splitDisplay = Object.entries(exp.exactSplits).map(([n, a]) => `${n.toUpperCase()}=${a}`).join(', ');
  } else if (exp.splitMembers.length === 0) splitDisplay = `ALL (${memberNames.length})`;
  else splitDisplay = exp.splitMembers.map((m) => m === '__SELF__' ? 'YOU' : m.toUpperCase()).join(' + ');
  return `[EXPENSE] ${exp.title.toUpperCase()}: ₹${exp.amount.toLocaleString('en-IN')} | PAID: ${payerDisplay} | SPLIT: ${splitDisplay} | ${exp.category.toUpperCase()}`;
}
