import { PersonalExpense, TripExpense } from '../types';
import { getCategoryConfig } from '../constants/categories';

export interface CategoryStat {
  category: string;
  label: string;
  icon: string;
  color: string;
  total: number;
  count: number;
  percentage: number;
}

export interface PeriodStats {
  total: number;
  count: number;
  average: number;
  topCategory: CategoryStat | null;
  categories: CategoryStat[];
}

export interface DailyStat {
  date: string;
  total: number;
}

export interface WeeklyTrend {
  week: string;
  total: number;
}

function groupByCategory(expenses: { amount: number; category: string }[]): CategoryStat[] {
  const map = new Map<string, { total: number; count: number }>();
  let grandTotal = 0;

  for (const e of expenses) {
    const key = e.category.toLowerCase();
    const existing = map.get(key) || { total: 0, count: 0 };
    existing.total += e.amount;
    existing.count += 1;
    map.set(key, existing);
    grandTotal += e.amount;
  }

  const stats: CategoryStat[] = [];
  map.forEach((value, key) => {
    const config = getCategoryConfig(key);
    stats.push({
      category: key,
      label: config.label,
      icon: config.icon,
      color: config.color,
      total: Math.round(value.total * 100) / 100,
      count: value.count,
      percentage: grandTotal > 0 ? Math.round((value.total / grandTotal) * 10000) / 100 : 0,
    });
  });

  stats.sort((a, b) => b.total - a.total);
  return stats;
}

export function computePersonalStats(
  expenses: PersonalExpense[],
  startTime?: number,
  endTime?: number
): PeriodStats {
  const filtered = expenses.filter(e => {
    if (startTime && e.createdAt < startTime) return false;
    if (endTime && e.createdAt > endTime) return false;
    return true;
  });

  const total = filtered.reduce((sum, e) => sum + e.amount, 0);
  const categories = groupByCategory(filtered);

  return {
    total: Math.round(total * 100) / 100,
    count: filtered.length,
    average: filtered.length > 0 ? Math.round((total / filtered.length) * 100) / 100 : 0,
    topCategory: categories[0] || null,
    categories,
  };
}

export function computeTripStats(
  expenses: TripExpense[],
  startTime?: number,
  endTime?: number
): PeriodStats {
  const filtered = expenses.filter(e => {
    if (startTime && e.updatedAt < startTime) return false;
    if (endTime && e.updatedAt > endTime) return false;
    return true;
  });

  const total = filtered.reduce((sum, e) => sum + e.amount, 0);
  const categories = groupByCategory(filtered);

  return {
    total: Math.round(total * 100) / 100,
    count: filtered.length,
    average: filtered.length > 0 ? Math.round((total / filtered.length) * 100) / 100 : 0,
    topCategory: categories[0] || null,
    categories,
  };
}

export function getDailyBreakdown(
  expenses: { amount: number; createdAt: number }[]
): DailyStat[] {
  const map = new Map<string, number>();

  for (const e of expenses) {
    const date = new Date(e.createdAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    map.set(key, (map.get(key) || 0) + e.amount);
  }

  return Array.from(map.entries())
    .map(([date, total]) => ({ date, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function getWeeklyTrend(
  expenses: { amount: number; createdAt: number }[]
): WeeklyTrend[] {
  const map = new Map<string, number>();

  for (const e of expenses) {
    const d = new Date(e.createdAt);
    const startOfWeek = new Date(d);
    startOfWeek.setDate(d.getDate() - d.getDay());
    const key = startOfWeek.toISOString().slice(0, 10);
    map.set(key, (map.get(key) || 0) + e.amount);
  }

  return Array.from(map.entries())
    .map(([week, total]) => ({ week, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => a.week.localeCompare(b.week));
}
