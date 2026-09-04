import * as SecureStore from 'expo-secure-store';

export interface Reminder {
  id: string;
  title: string;
  amount?: number;
  category: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  nextDue: number; // epoch millis
  enabled: boolean;
  createdAt: number;
}

const REMINDERS_KEY = 'mv_reminders';

export async function loadReminders(): Promise<Reminder[]> {
  const data = await SecureStore.getItemAsync(REMINDERS_KEY);
  return data ? JSON.parse(data) : [];
}

export async function saveReminder(reminder: Reminder): Promise<void> {
  const reminders = await loadReminders();
  const idx = reminders.findIndex(r => r.id === reminder.id);
  if (idx >= 0) reminders[idx] = reminder;
  else reminders.push(reminder);
  await SecureStore.setItemAsync(REMINDERS_KEY, JSON.stringify(reminders));
}

export async function deleteReminder(id: string): Promise<void> {
  const reminders = await loadReminders();
  await SecureStore.setItemAsync(REMINDERS_KEY, JSON.stringify(reminders.filter(r => r.id !== id)));
}

export async function toggleReminder(id: string): Promise<void> {
  const reminders = await loadReminders();
  const r = reminders.find(rm => rm.id === id);
  if (r) {
    r.enabled = !r.enabled;
    await SecureStore.setItemAsync(REMINDERS_KEY, JSON.stringify(reminders));
  }
}

export function computeNextDueDate(frequency: Reminder['frequency'], from?: number): number {
  const base = from || Date.now();
  const d = new Date(base);
  switch (frequency) {
    case 'daily': d.setDate(d.getDate() + 1); break;
    case 'weekly': d.setDate(d.getDate() + 7); break;
    case 'monthly': d.setMonth(d.getMonth() + 1); break;
    case 'yearly': d.setFullYear(d.getFullYear() + 1); break;
  }
  return d.getTime();
}

export function isDue(reminder: Reminder): boolean {
  if (!reminder.enabled) return false;
  return reminder.nextDue <= Date.now();
}

export function formatFrequency(freq: Reminder['frequency']): string {
  switch (freq) {
    case 'daily': return 'Every day';
    case 'weekly': return 'Every week';
    case 'monthly': return 'Every month';
    case 'yearly': return 'Every year';
  }
}
