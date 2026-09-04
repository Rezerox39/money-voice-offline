import * as Sharing from 'expo-sharing';
import { PersonalExpense, TripExpense, Trip } from '../types';
import { getCategoryConfig } from '../constants/categories';

function formatCurrency(amount: number, symbol: string = '₹'): string {
  return `${symbol}${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(epoch: number): string {
  return new Date(epoch).toLocaleDateString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function escapeCsv(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export async function exportPersonalCsv(expenses: PersonalExpense[]): Promise<void> {
  const header = 'Date,Title,Category,Amount,Note\n';
  const rows = expenses.map(e => {
    const cat = getCategoryConfig(e.category);
    return [
      formatDate(e.createdAt),
      escapeCsv(e.title),
      escapeCsv(cat.label),
      e.amount.toFixed(2),
      escapeCsv(e.note || ''),
    ].join(',');
  }).join('\n');

  const csv = header + rows;
  await Sharing.shareAsync('data:text/csv;charset=utf-8,' + encodeURIComponent(csv), {
    mimeType: 'text/csv',
    dialogTitle: 'Export Expenses',
  });
}

export async function exportTripCsv(trip: Trip): Promise<void> {
  const header = 'Date,Title,Category,Paid By,Amount\n';
  const memberMap = new Map(trip.members.map(m => [m.id, m.name]));
  const rows = trip.expenses.map(e => {
    const cat = getCategoryConfig(e.category);
    return [
      formatDate(e.updatedAt),
      escapeCsv(e.title),
      escapeCsv(cat.label),
      escapeCsv(memberMap.get(e.paidBy) || e.paidBy),
      e.amount.toFixed(2),
    ].join(',');
  }).join('\n');

  const csv = header + rows;
  await Sharing.shareAsync('data:text/csv;charset=utf-8,' + encodeURIComponent(csv), {
    mimeType: 'text/csv',
    dialogTitle: `Export ${trip.name}`,
  });
}

export async function exportSettlementText(
  tripName: string,
  totalExpenses: number,
  settlements: { from: string; to: string; amount: number }[],
  memberMap: Map<string, string>,
  poolBalance?: number
): Promise<void> {
  let text = `🏖️ *${tripName} Settlement Breakdown*\n`;
  text += `Total Expenses: ${formatCurrency(totalExpenses)}\n\n`;
  text += `*Settlement Instructions:*\n`;
  for (const s of settlements) {
    const from = memberMap.get(s.from) || s.from;
    const to = memberMap.get(s.to) || s.to;
    text += `• ${from} owes ${to}: ${formatCurrency(s.amount)}\n`;
  }
  if (poolBalance !== undefined) {
    text += `\nPool Remaining: ${formatCurrency(poolBalance)}\n`;
  }
  text += `\n_Generated locally via Money Voice._`;

  await Sharing.shareAsync('data:text/plain;charset=utf-8,' + encodeURIComponent(text), {
    mimeType: 'text/plain',
    dialogTitle: 'Share Settlement',
  });
}
