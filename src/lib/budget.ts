import * as SecureStore from 'expo-secure-store';

export interface BudgetGoal {
  id: string;
  category: string;
  monthlyLimit: number;
  currency: string;
  createdAt: number;
}

export interface BudgetStatus {
  goal: BudgetGoal;
  spent: number;
  remaining: number;
  percentage: number;
  isOverBudget: boolean;
}

const BUDGET_KEY = 'mv_budget_goals';

export async function loadBudgetGoals(): Promise<BudgetGoal[]> {
  const data = await SecureStore.getItemAsync(BUDGET_KEY);
  return data ? JSON.parse(data) : [];
}

export async function saveBudgetGoal(goal: BudgetGoal): Promise<void> {
  const goals = await loadBudgetGoals();
  const idx = goals.findIndex(g => g.id === goal.id);
  if (idx >= 0) goals[idx] = goal;
  else goals.push(goal);
  await SecureStore.setItemAsync(BUDGET_KEY, JSON.stringify(goals));
}

export async function deleteBudgetGoal(id: string): Promise<void> {
  const goals = await loadBudgetGoals();
  await SecureStore.setItemAsync(BUDGET_KEY, JSON.stringify(goals.filter(g => g.id !== id)));
}

export function computeBudgetStatus(
  goals: BudgetGoal[],
  expenses: { category: string; amount: number }[],
  month: number,
  year: number
): BudgetStatus[] {
  return goals.map(goal => {
    const spent = expenses
      .filter(e => e.category.toLowerCase() === goal.category.toLowerCase())
      .reduce((sum, e) => sum + e.amount, 0);

    const remaining = Math.max(0, goal.monthlyLimit - spent);
    const percentage = goal.monthlyLimit > 0
      ? Math.min(100, Math.round((spent / goal.monthlyLimit) * 100))
      : 0;

    return {
      goal,
      spent: Math.round(spent * 100) / 100,
      remaining: Math.round(remaining * 100) / 100,
      percentage,
      isOverBudget: spent > goal.monthlyLimit,
    };
  });
}
