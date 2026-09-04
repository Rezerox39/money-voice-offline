import * as SQLite from 'expo-sqlite';
import { Trip, TripExpense, Member, SplitShare, PoolDeposit, PersonalExpense } from '../types';
import { generateUUID } from './uuid';

let db: SQLite.SQLiteDatabase;

export class DatabaseCorruptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseCorruptionError';
  }
}

export async function initDatabase(): Promise<void> {
  db = await SQLite.openDatabaseAsync('moneyvoice.db');

  // ── Pragmas for crash resilience ──────────────────────────────
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS trips (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      trip_id TEXT NOT NULL,
      name TEXT NOT NULL,
      upi_or_handle TEXT,
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      trip_id TEXT NOT NULL,
      title TEXT NOT NULL,
      amount REAL NOT NULL,
      paid_by TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Other',
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
      FOREIGN KEY (paid_by) REFERENCES members(id)
    );

    CREATE TABLE IF NOT EXISTS split_shares (
      id TEXT PRIMARY KEY,
      expense_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      amount REAL NOT NULL,
      FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
      FOREIGN KEY (member_id) REFERENCES members(id)
    );

    CREATE TABLE IF NOT EXISTS pool_deposits (
      id TEXT PRIMARY KEY,
      trip_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      amount REAL NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS personal_expenses (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL DEFAULT 'Other',
      note TEXT,
      created_at INTEGER NOT NULL
    );
  `);

  // ── Cold-boot integrity check ─────────────────────────────────
  try {
    const result = await db.getFirstAsync<{ integrity_check: string }>(
      'PRAGMA quick_check'
    );
    if (result?.integrity_check !== 'ok') {
      throw new DatabaseCorruptionError(
        'Database integrity check failed: ' + (result?.integrity_check ?? 'unknown')
      );
    }
  } catch (err) {
    if (err instanceof DatabaseCorruptionError) throw err;
    // quick_check unavailable or other error — proceed with caution
  }

  // ── Deterministic seed on fresh install ───────────────────────
  await seedIfEmpty(db);
}

const SEED_CATEGORIES = ['Food', 'Transport', 'Accommodation', 'Shopping', 'Entertainment', 'Utilities', 'Other'];

async function seedIfEmpty(database: SQLite.SQLiteDatabase): Promise<void> {
  const tripCount = await database.getFirstAsync<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM trips'
  );
  if (tripCount && tripCount.cnt > 0) return; // Not empty — skip seed

  const now = Date.now();
  const tripId = generateUUID();
  const memberIds = [generateUUID(), generateUUID()];

  await database.withExclusiveTransactionAsync(async (txn) => {
    // Seed welcome trip
    await txn.runAsync(
      'INSERT INTO trips (id, name, currency, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [tripId, 'Welcome Trip', 'INR', now, now]
    );
    // Seed two members
    await txn.runAsync(
      'INSERT INTO members (id, trip_id, name, upi_or_handle) VALUES (?, ?, ?, ?)',
      [memberIds[0], tripId, 'You', null]
    );
    await txn.runAsync(
      'INSERT INTO members (id, trip_id, name, upi_or_handle) VALUES (?, ?, ?, ?)',
      [memberIds[1], tripId, 'Friend', null]
    );
  });
}

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) await initDatabase();
  return db;
}

// ── Read helpers (single-statement, no transaction needed) ─────────

export async function getAllTrips(): Promise<Trip[]> {
  const database = await getDb();
  const tripRows = await database.getAllAsync<{
    id: string;
    name: string;
    currency: string;
    created_at: number;
    updated_at: number;
  }>('SELECT * FROM trips ORDER BY updated_at DESC');

  const trips: Trip[] = [];
  for (const row of tripRows) {
    const members = await getMembersByTripId(row.id);
    const expenses = await getExpensesByTripId(row.id);
    trips.push({
      id: row.id,
      name: row.name,
      currency: row.currency,
      members,
      expenses,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
  return trips;
}

export async function getTripById(id: string): Promise<Trip | null> {
  const database = await getDb();
  const row = await database.getFirstAsync<{
    id: string;
    name: string;
    currency: string;
    created_at: number;
    updated_at: number;
  }>('SELECT * FROM trips WHERE id = ?', [id]);

  if (!row) return null;

  const members = await getMembersByTripId(row.id);
  const expenses = await getExpensesByTripId(row.id);

  return {
    id: row.id,
    name: row.name,
    currency: row.currency,
    members,
    expenses,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getMembersByTripId(tripId: string): Promise<Member[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<{
    id: string;
    name: string;
    upi_or_handle: string | null;
  }>('SELECT * FROM members WHERE trip_id = ?', [tripId]);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    upiOrHandle: r.upi_or_handle || undefined,
  }));
}

async function getExpensesByTripId(tripId: string): Promise<TripExpense[]> {
  const database = await getDb();
  const expenseRows = await database.getAllAsync<{
    id: string;
    trip_id: string;
    title: string;
    amount: number;
    paid_by: string;
    category: string;
    updated_at: number;
  }>('SELECT * FROM expenses WHERE trip_id = ? ORDER BY updated_at DESC', [tripId]);

  const expenses: TripExpense[] = [];
  for (const row of expenseRows) {
    const shares = await database.getAllAsync<{
      member_id: string;
      amount: number;
    }>('SELECT member_id, amount FROM split_shares WHERE expense_id = ?', [row.id]);

    expenses.push({
      id: row.id,
      tripId: row.trip_id,
      title: row.title,
      amount: row.amount,
      paidBy: row.paid_by,
      splitBetween: shares.map((s) => ({ memberId: s.member_id, amount: s.amount })),
      category: row.category,
      updatedAt: row.updated_at,
    });
  }
  return expenses;
}

// Transaction helper — uses the txn object directly inside withExclusiveTransactionAsync
// Transaction extends SQLiteDatabase so txn has the same query methods.



// ── Personal Expense CRUD (offline-first, no trip association) ──────

export async function getPersonalExpenses(): Promise<PersonalExpense[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<{
    id: string;
    title: string;
    amount: number;
    category: string;
    note: string | null;
    created_at: number;
  }>('SELECT * FROM personal_expenses ORDER BY created_at DESC');

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    amount: r.amount,
    category: r.category,
    note: r.note || undefined,
    createdAt: r.created_at,
  }));
}

export async function addPersonalExpense(
  title: string,
  amount: number,
  category: string,
  note?: string
): Promise<PersonalExpense> {
  const database = await getDb();
  const id = generateUUID();
  const now = Date.now();

  await database.runAsync(
    'INSERT INTO personal_expenses (id, title, amount, category, note, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, title, amount, category, note ?? null, now]
  );

  return { id, title, amount, category, note, createdAt: now };
}

export async function deletePersonalExpense(id: string): Promise<void> {
  const database = await getDb();
  await database.runAsync('DELETE FROM personal_expenses WHERE id = ?', [id]);
}

// ── Pool Deposit CRUD (append-only, event-sourced) ─────────────────

export async function getPoolDepositsByTripId(tripId: string): Promise<PoolDeposit[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<{
    id: string;
    trip_id: string;
    member_id: string;
    amount: number;
    created_at: number;
  }>('SELECT * FROM pool_deposits WHERE trip_id = ? ORDER BY created_at ASC', [tripId]);

  return rows.map((r) => ({
    id: r.id,
    tripId: r.trip_id,
    memberId: r.member_id,
    amount: r.amount,
    createdAt: r.created_at,
  }));
}

export async function addPoolDeposit(
  tripId: string,
  memberId: string,
  amount: number
): Promise<PoolDeposit> {
  const database = await getDb();
  const id = generateUUID();
  const now = Date.now();

  await database.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      'INSERT INTO pool_deposits (id, trip_id, member_id, amount, created_at) VALUES (?, ?, ?, ?, ?)',
      [id, tripId, memberId, amount, now]
    );
    await txn.runAsync('UPDATE trips SET updated_at = ? WHERE id = ?', [now, tripId]);
  });

  return { id, tripId, memberId, amount, createdAt: now };
}

async function getExistingMemberIds(
  txn: Pick<SQLite.SQLiteDatabase, 'getAllAsync'>,
  tripId: string
): Promise<Set<string>> {
  const rows = await txn.getAllAsync<{ id: string }>(
    'SELECT id FROM members WHERE trip_id = ?',
    [tripId]
  );
  return new Set(rows.map((r) => r.id));
}

async function getExistingExpenses(
  txn: Pick<SQLite.SQLiteDatabase, 'getAllAsync'>,
  tripId: string
): Promise<Map<string, TripExpense>> {
  const expenseRows = await txn.getAllAsync<{
    id: string;
    trip_id: string;
    title: string;
    amount: number;
    paid_by: string;
    category: string;
    updated_at: number;
  }>('SELECT * FROM expenses WHERE trip_id = ?', [tripId]);

  const map = new Map<string, TripExpense>();
  for (const row of expenseRows) {
    const shares = await txn.getAllAsync<{ member_id: string; amount: number }>(
      'SELECT member_id, amount FROM split_shares WHERE expense_id = ?',
      [row.id]
    );
    map.set(row.id, {
      id: row.id,
      tripId: row.trip_id,
      title: row.title,
      amount: row.amount,
      paidBy: row.paid_by,
      splitBetween: shares.map((s) => ({ memberId: s.member_id, amount: s.amount })),
      category: row.category,
      updatedAt: row.updated_at,
    });
  }
  return map;
}

// ── Write operations (transactional) ───────────────────────────────

export async function createTrip(name: string, currency: string): Promise<Trip> {
  const database = await getDb();
  const id = generateUUID();
  const now = Date.now();

  await database.runAsync(
    'INSERT INTO trips (id, name, currency, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [id, name, currency, now, now]
  );

  return { id, name, currency, members: [], expenses: [], createdAt: now, updatedAt: now };
}

export async function addMember(
  tripId: string,
  name: string,
  upiOrHandle?: string
): Promise<Member> {
  const database = await getDb();
  const id = generateUUID();

  await database.runAsync(
    'INSERT INTO members (id, trip_id, name, upi_or_handle) VALUES (?, ?, ?, ?)',
    [id, tripId, name, upiOrHandle || null]
  );

  return { id, name, upiOrHandle };
}

export async function deleteTrip(id: string): Promise<void> {
  const database = await getDb();
  await database.runAsync('DELETE FROM trips WHERE id = ?', [id]);
}

export async function deleteMember(id: string): Promise<void> {
  const database = await getDb();
  await database.runAsync('DELETE FROM members WHERE id = ?', [id]);
}

/**
 * Add an expense with its split shares atomically.
 * The expense row, all split_shares rows, and the trip's updated_at
 * are written in a single exclusive transaction — no orphaned rows on failure.
 */
export async function addExpense(
  tripId: string,
  title: string,
  amount: number,
  paidBy: string,
  splitBetween: SplitShare[],
  category: string
): Promise<TripExpense> {
  const database = await getDb();
  const id = generateUUID();
  const now = Date.now();

  await database.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      'INSERT INTO expenses (id, trip_id, title, amount, paid_by, category, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, tripId, title, amount, paidBy, category, now]
    );

    for (const share of splitBetween) {
      const shareId = generateUUID();
      await txn.runAsync(
        'INSERT INTO split_shares (id, expense_id, member_id, amount) VALUES (?, ?, ?, ?)',
        [shareId, id, share.memberId, share.amount]
      );
    }

    await txn.runAsync('UPDATE trips SET updated_at = ? WHERE id = ?', [now, tripId]);
  });

  return { id, tripId, title, amount, paidBy, splitBetween, category, updatedAt: now };
}

/**
 * Delete an expense and all its split shares atomically.
 */
export async function deleteExpense(id: string): Promise<void> {
  const database = await getDb();
  await database.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM split_shares WHERE expense_id = ?', [id]);
    await txn.runAsync('DELETE FROM expenses WHERE id = ?', [id]);
  });
}

/**
 * QR Sync merge — entire LWW merge runs inside one exclusive transaction.
 * Members are appended, expenses are inserted or overwritten by updatedAt.
 * The transaction guarantees no half-written state on error.
 */
export async function mergeTripFromPayload(incomingTrip: Trip): Promise<{
  inserted: number;
  updated: number;
  membersAdded: number;
}> {
  const database = await getDb();
  let inserted = 0;
  let updated = 0;
  let membersAdded = 0;

  await database.withExclusiveTransactionAsync(async (txn) => {
    // Upsert trip
    const existingTripRow = await txn.getFirstAsync<{
      id: string;
      updated_at: number;
    }>('SELECT id, updated_at FROM trips WHERE id = ?', [incomingTrip.id]);

    if (!existingTripRow) {
      await txn.runAsync(
        'INSERT INTO trips (id, name, currency, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [incomingTrip.id, incomingTrip.name, incomingTrip.currency, incomingTrip.createdAt, incomingTrip.updatedAt]
      );
    } else if (incomingTrip.updatedAt > existingTripRow.updated_at) {
      await txn.runAsync(
        'UPDATE trips SET name = ?, currency = ?, updated_at = ? WHERE id = ?',
        [incomingTrip.name, incomingTrip.currency, incomingTrip.updatedAt, incomingTrip.id]
      );
    }

    // Merge members: append new ones
    const existingMemberIds = await getExistingMemberIds(txn, incomingTrip.id);

    for (const member of incomingTrip.members) {
      if (!existingMemberIds.has(member.id)) {
        await txn.runAsync(
          'INSERT INTO members (id, trip_id, name, upi_or_handle) VALUES (?, ?, ?, ?)',
          [member.id, incomingTrip.id, member.name, member.upiOrHandle || null]
        );
        membersAdded++;
      }
    }

    // Merge expenses: LWW by updatedAt
    const existingExpenses = await getExistingExpenses(txn, incomingTrip.id);

    for (const expense of incomingTrip.expenses) {
      const existing = existingExpenses.get(expense.id);
      if (!existing) {
        await txn.runAsync(
          'INSERT INTO expenses (id, trip_id, title, amount, paid_by, category, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [expense.id, expense.tripId, expense.title, expense.amount, expense.paidBy, expense.category, expense.updatedAt]
        );
        for (const share of expense.splitBetween) {
          const shareId = generateUUID();
          await txn.runAsync(
            'INSERT INTO split_shares (id, expense_id, member_id, amount) VALUES (?, ?, ?, ?)',
            [shareId, expense.id, share.memberId, share.amount]
          );
        }
        inserted++;
      } else if (expense.updatedAt > existing.updatedAt) {
        await txn.runAsync(
          'UPDATE expenses SET title = ?, amount = ?, paid_by = ?, category = ?, updated_at = ? WHERE id = ?',
          [expense.title, expense.amount, expense.paidBy, expense.category, expense.updatedAt, expense.id]
        );
        await txn.runAsync('DELETE FROM split_shares WHERE expense_id = ?', [expense.id]);
        for (const share of expense.splitBetween) {
          const shareId = generateUUID();
          await txn.runAsync(
            'INSERT INTO split_shares (id, expense_id, member_id, amount) VALUES (?, ?, ?, ?)',
            [shareId, expense.id, share.memberId, share.amount]
          );
        }
        updated++;
      }
    }

    // Merge pool_deposits: append new, LWW for existing
    const existingDeposits = await txn.getAllAsync<{ id: string; created_at: number }>(
      'SELECT id, created_at FROM pool_deposits WHERE trip_id = ?',
      [incomingTrip.id]
    );
    const existingDepositMap = new Map(existingDeposits.map((r) => [r.id, r.created_at]));

    const incomingDeposits = (incomingTrip as any).poolDeposits as PoolDeposit[] | undefined;
    if (incomingDeposits) {
      for (const dep of incomingDeposits) {
        const existingTs = existingDepositMap.get(dep.id);
        if (existingTs === undefined) {
          await txn.runAsync(
            'INSERT INTO pool_deposits (id, trip_id, member_id, amount, created_at) VALUES (?, ?, ?, ?, ?)',
            [dep.id, dep.tripId, dep.memberId, dep.amount, dep.createdAt]
          );
        } else if (dep.createdAt > existingTs) {
          await txn.runAsync(
            'UPDATE pool_deposits SET amount = ?, created_at = ? WHERE id = ?',
            [dep.amount, dep.createdAt, dep.id]
          );
        }
      }
    }
  });

  return { inserted, updated, membersAdded };
}

// ── Emergency Reset (Panic Wipe) ───────────────────────────────────

export async function resetDatabase(): Promise<void> {
  const database = await getDb();
  await database.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM split_shares');
    await txn.runAsync('DELETE FROM expenses');
    await txn.runAsync('DELETE FROM pool_deposits');
    await txn.runAsync('DELETE FROM personal_expenses');
    await txn.runAsync('DELETE FROM members');
    await txn.runAsync('DELETE FROM trips');
  });
  // Re-seed with fresh welcome trip
  await seedIfEmpty(database);
}
