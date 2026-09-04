import { PersonalExpense, TripExpense } from '../types';

export interface SearchFilters {
  query: string;
  category?: string;
  minAmount?: number;
  maxAmount?: number;
  startDate?: number;
  endDate?: number;
}

export function matchesFilters<T extends { title: string; amount: number; category: string; createdAt?: number; updatedAt?: number }>(
  items: T[],
  filters: SearchFilters
): T[] {
  return items.filter(item => {
    if (filters.query) {
      const q = filters.query.toLowerCase();
      if (!item.title.toLowerCase().includes(q) && !item.category.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (filters.category && item.category.toLowerCase() !== filters.category.toLowerCase()) {
      return false;
    }
    if (filters.minAmount !== undefined && item.amount < filters.minAmount) {
      return false;
    }
    if (filters.maxAmount !== undefined && item.amount > filters.maxAmount) {
      return false;
    }
    const time = item.createdAt || item.updatedAt || 0;
    if (filters.startDate && time < filters.startDate) return false;
    if (filters.endDate && time > filters.endDate) return false;
    return true;
  });
}
