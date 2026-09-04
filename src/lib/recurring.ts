import * as SecureStore from 'expo-secure-store';
import { generateUUID } from './uuid';

export type RecurringInterval = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurringExpense {
  id: string;
  title: string;
  amount: number;
  category: string;
  interval: RecurringInterval;
  nextDueDate: number;
  lastTriggered?: number;
  enabled: boolean;
  createdAt: number;
}

const RECURRING_KEY = 'mv_recurring_expenses';

export async function loadRecurring(): Promise<RecurringExpense[]> {
  const data = await SecureStore.getItemAsync(RECURRING_KEY);
  return data ? JSON.parse(data) : [];
}

export async function saveRecurring(expense: RecurringExpense): Promise<void> {
  const items = await loadRecurring();
  const idx = items.findIndex(i => i.id === expense.id);
  if (idx >= 0) items[idx] = expense;
  else items.push(expense);
  await SecureStore.setItemAsync(RECURRING_KEY, JSON.stringify(items));
}

export async function deleteRecurring(id: string): Promise<void> {
  const items = await loadRecurring();
  await SecureStore.setItemAsync(RECURRING_KEY, JSON.stringify(items.filter(i => i.id !== id)));
}

export function computeNextDueDate(interval: RecurringInterval, from: number = Date.now()): number {
  const d = new Date(from);
  switch (interval) {
    case 'daily': d.setDate(d.getDate() + 1); break;
    case 'weekly': d.setDate(d.getDate() + 7); break;
    case 'monthly': d.setMonth(d.getMonth() + 1); break;
    case 'yearly': d.setFullYear(d.getFullYear() + 1); break;
  }
  return d.getTime();
}

export function isDue(recurring: RecurringExpense, now: number = Date.now()): boolean {
  if (!recurring.enabled) return false;
  return now >= recurring.nextDueDate;
}

export function createRecurringExpense(
  title: string,
  amount: number,
  category: string,
  interval: RecurringInterval
): RecurringExpense {
  return {
    id: generateUUID(),
    title,
    amount,
    category,
    interval,
    nextDueDate: computeNextDueDate(interval),
    enabled: true,
    createdAt: Date.now(),
  };
}
