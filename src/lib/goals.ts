import * as SecureStore from 'expo-secure-store';

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: string;
  deadline?: number; // epoch millis
  createdAt: number;
  color: string;
}

const GOALS_KEY = 'mv_savings_goals';

const GOAL_COLORS = ['#00FF66', '#FFB000', '#3366FF', '#FF6633', '#CC33FF', '#FF3366'];

export async function loadGoals(): Promise<SavingsGoal[]> {
  const data = await SecureStore.getItemAsync(GOALS_KEY);
  return data ? JSON.parse(data) : [];
}

export async function saveGoal(goal: SavingsGoal): Promise<void> {
  const goals = await loadGoals();
  const idx = goals.findIndex(g => g.id === goal.id);
  if (idx >= 0) goals[idx] = goal;
  else goals.push(goal);
  await SecureStore.setItemAsync(GOALS_KEY, JSON.stringify(goals));
}

export async function deleteGoal(id: string): Promise<void> {
  const goals = await loadGoals();
  await SecureStore.setItemAsync(GOALS_KEY, JSON.stringify(goals.filter(g => g.id !== id)));
}

export async function addToGoal(id: string, amount: number): Promise<SavingsGoal | null> {
  const goals = await loadGoals();
  const goal = goals.find(g => g.id === id);
  if (!goal) return null;
  goal.currentAmount = Math.round((goal.currentAmount + amount) * 100) / 100;
  await saveGoal(goal);
  return goal;
}

export function computeGoalProgress(goal: SavingsGoal): {
  percentage: number;
  remaining: number;
  isComplete: boolean;
  daysLeft?: number;
} {
  const percentage = goal.targetAmount > 0
    ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))
    : 0;
  const remaining = Math.max(0, Math.round((goal.targetAmount - goal.currentAmount) * 100) / 100);
  const isComplete = goal.currentAmount >= goal.targetAmount;

  let daysLeft: number | undefined;
  if (goal.deadline) {
    daysLeft = Math.max(0, Math.ceil((goal.deadline - Date.now()) / (24 * 60 * 60 * 1000)));
  }

  return { percentage, remaining, isComplete, daysLeft };
}

export function pickGoalColor(index: number): string {
  return GOAL_COLORS[index % GOAL_COLORS.length];
}
