import * as SecureStore from 'expo-secure-store';

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastLogDate: string; // YYYY-MM-DD
  totalDaysLogged: number;
}

const STREAK_KEY = 'mv_streak_data';

function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getYesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function getStreakData(): Promise<StreakData> {
  const data = await SecureStore.getItemAsync(STREAK_KEY);
  return data ? JSON.parse(data) : {
    currentStreak: 0,
    longestStreak: 0,
    lastLogDate: '',
    totalDaysLogged: 0,
  };
}

export async function recordActivity(): Promise<StreakData> {
  const streak = await getStreakData();
  const today = getTodayString();
  const yesterday = getYesterdayString();

  if (streak.lastLogDate === today) {
    return streak;
  }

  let newStreak: number;
  if (streak.lastLogDate === yesterday) {
    newStreak = streak.currentStreak + 1;
  } else {
    newStreak = 1;
  }

  const updated: StreakData = {
    currentStreak: newStreak,
    longestStreak: Math.max(streak.longestStreak, newStreak),
    lastLogDate: today,
    totalDaysLogged: streak.totalDaysLogged + (streak.lastLogDate === today ? 0 : 1),
  };

  await SecureStore.setItemAsync(STREAK_KEY, JSON.stringify(updated));
  return updated;
}

export function formatStreak(streak: StreakData): string {
  if (streak.currentStreak === 0) return 'No active streak';
  if (streak.currentStreak === 1) return '1 day streak';
  return `${streak.currentStreak} day streak 🔥`;
}
