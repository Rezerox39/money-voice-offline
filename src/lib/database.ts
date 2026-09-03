import * as SQLite from 'expo-sqlite';
import { Trip, TripExpense, Member, SplitShare } from '../types';
import { generateUUID } from './uuid';

let db: SQLite.SQLiteDatabase;

export async function initDatabase(): Promise<void> {
  db = await SQLite.openDatabaseAsync('moneyvoice.db');

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

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
  `);
}

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) await initDatabase();
  return db;
}

// ── Trips ──────────────────────────────────────────────────────────

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

export async function deleteTrip(id: string): Promise<void> {
  const database = await getDb();
  await database.runAsync('DELETE FROM trips WHERE id = ?', [id]);
}

// ── Members ────────────────────────────────────────────────────────

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

export async function getMembersByTripId(tripId: string): Promise<Member[]> {
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

export async function deleteMember(id: string): Promise<void> {
  const database = await getDb();
  await database.runAsync('DELETE FROM members WHERE id = ?', [id]);
}

// ── Expenses ───────────────────────────────────────────────────────

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

  await database.runAsync(
    'INSERT INTO expenses (id, trip_id, title, amount, paid_by, category, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, tripId, title, amount, paidBy, category, now]
  );

  for (const share of splitBetween) {
    const shareId = generateUUID();
    await database.runAsync(
      'INSERT INTO split_shares (id, expense_id, member_id, amount) VALUES (?, ?, ?, ?)',
      [shareId, id, share.memberId, share.amount]
    );
  }

  await database.runAsync('UPDATE trips SET updated_at = ? WHERE id = ?', [now, tripId]);

  return { id, tripId, title, amount, paidBy, splitBetween, category, updatedAt: now };
}

export async function getExpensesByTripId(tripId: string): Promise<TripExpense[]> {
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

export async function deleteExpense(id: string): Promise<void> {
  const database = await getDb();
  await database.runAsync('DELETE FROM split_shares WHERE expense_id = ?', [id]);
  await database.runAsync('DELETE FROM expenses WHERE id = ?', [id]);
}

// ── QR Sync Merge (Last-Write-Wins) ────────────────────────────────

export async function mergeTripFromPayload(incomingTrip: Trip): Promise<{
  inserted: number;
  updated: number;
  membersAdded: number;
}> {
  const database = await getDb();
  let inserted = 0;
  let updated = 0;
  let membersAdded = 0;

  // Upsert trip
  const existingTrip = await getTripById(incomingTrip.id);
  if (!existingTrip) {
    await database.runAsync(
      'INSERT INTO trips (id, name, currency, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [incomingTrip.id, incomingTrip.name, incomingTrip.currency, incomingTrip.createdAt, incomingTrip.updatedAt]
    );
  } else if (incomingTrip.updatedAt > existingTrip.updatedAt) {
    await database.runAsync(
      'UPDATE trips SET name = ?, currency = ?, updated_at = ? WHERE id = ?',
      [incomingTrip.name, incomingTrip.currency, incomingTrip.updatedAt, incomingTrip.id]
    );
  }

  // Merge members: append new ones
  const existingMembers = await getMembersByTripId(incomingTrip.id);
  const existingMemberIds = new Set(existingMembers.map((m) => m.id));

  for (const member of incomingTrip.members) {
    if (!existingMemberIds.has(member.id)) {
      await database.runAsync(
        'INSERT INTO members (id, trip_id, name, upi_or_handle) VALUES (?, ?, ?, ?)',
        [member.id, incomingTrip.id, member.name, member.upiOrHandle || null]
      );
      membersAdded++;
    }
  }

  // Merge expenses: LWW by updatedAt
  const existingExpenses = await getExpensesByTripId(incomingTrip.id);
  const existingExpenseMap = new Map(existingExpenses.map((e) => [e.id, e]));

  for (const expense of incomingTrip.expenses) {
    const existing = existingExpenseMap.get(expense.id);
    if (!existing) {
      // Insert new expense
      await database.runAsync(
        'INSERT INTO expenses (id, trip_id, title, amount, paid_by, category, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [expense.id, expense.tripId, expense.title, expense.amount, expense.paidBy, expense.category, expense.updatedAt]
      );
      for (const share of expense.splitBetween) {
        const shareId = generateUUID();
        await database.runAsync(
          'INSERT INTO split_shares (id, expense_id, member_id, amount) VALUES (?, ?, ?, ?)',
          [shareId, expense.id, share.memberId, share.amount]
        );
      }
      inserted++;
    } else if (expense.updatedAt > existing.updatedAt) {
      // Overwrite with incoming (LWW)
      await database.runAsync(
        'UPDATE expenses SET title = ?, amount = ?, paid_by = ?, category = ?, updated_at = ? WHERE id = ?',
        [expense.title, expense.amount, expense.paidBy, expense.category, expense.updatedAt, expense.id]
      );
      await database.runAsync('DELETE FROM split_shares WHERE expense_id = ?', [expense.id]);
      for (const share of expense.splitBetween) {
        const shareId = generateUUID();
        await database.runAsync(
          'INSERT INTO split_shares (id, expense_id, member_id, amount) VALUES (?, ?, ?, ?)',
          [shareId, expense.id, share.memberId, share.amount]
        );
      }
      updated++;
    }
  }

  return { inserted, updated, membersAdded };
}
