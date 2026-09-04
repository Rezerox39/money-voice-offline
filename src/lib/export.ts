import { PersonalExpense, Trip, CURRENCIES } from '../types';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { SettlementTransaction } from '../types';

export function expensesToCSV(expenses: PersonalExpense[], currency: string = 'INR'): string {
  const sym = CURRENCIES[currency]?.symbol || '₹';
  const header = 'Date,Title,Category,Amount,Note\n';
  const rows = expenses.map(e => {
    const date = new Date(e.createdAt).toLocaleDateString('en-IN');
    return `${date},"${e.title.replace(/"/g, '""')}",${e.category},${sym}${e.amount.toFixed(2)},"${(e.note || '').replace(/"/g, '""')}"`;
  }).join('\n');
  return header + rows;
}

export function tripToCSV(trip: Trip): string {
  const sym = CURRENCIES[trip.currency]?.symbol || '₹';
  const header = 'Date,Title,Payer,Category,Amount,Split\n';
  const memberMap = new Map(trip.members.map(m => [m.id, m.name]));

  const rows = trip.expenses.map(e => {
    const date = new Date(e.updatedAt).toLocaleDateString('en-IN');
    const payer = memberMap.get(e.paidBy) || 'Unknown';
    const splitNames = e.splitBetween.map(s => memberMap.get(s.memberId) || '?').join('+');
    return `${date},"${e.title.replace(/"/g, '""')}",${payer},${e.category},${sym}${e.amount.toFixed(2)},"${splitNames}"`;
  }).join('\n');
  return header + rows;
}

export function generateSettlementText(
  tripName: string,
  totalExpenses: number,
  currency: string,
  settlements: SettlementTransaction[],
  memberMap: Map<string, string>,
): string {
  const sym = CURRENCIES[currency]?.symbol || '₹';
  let text = `🏖️ *${tripName} Settlement Breakdown*\n`;
  text += `Total Expenses: ${sym}${totalExpenses.toLocaleString('en-IN')}\n\n`;
  text += `*Settlement Instructions:*\n`;

  if (settlements.length === 0) {
    text += `All balances are fully settled. Nobody owes anything.\n`;
  } else {
    for (const s of settlements) {
      const from = memberMap.get(s.from) || s.from;
      const to = memberMap.get(s.to) || s.to;
      text += `• ${from} owes ${to}: ${sym}${s.amount.toLocaleString('en-IN')}\n`;
    }
  }

  text += `\n_Generated locally via Money Voice._`;
  return text;
}

export function generatePersonalSummary(
  expenses: PersonalExpense[],
  currency: string,
): string {
  const sym = CURRENCIES[currency]?.symbol || '₹';
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  let text = `📊 *Expense Summary*\nTotal: ${sym}${total.toLocaleString('en-IN')}\n\n`;

  const byCategory: Record<string, number> = {};
  for (const e of expenses) {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
  }

  const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  for (const [cat, amt] of sorted) {
    const pct = total > 0 ? Math.round((amt / total) * 100) : 0;
    text += `• ${cat}: ${sym}${amt.toLocaleString('en-IN')} (${pct}%)\n`;
  }

  text += `\n_Generated locally via Money Voice._`;
  return text;
}

export async function exportAndShare(content: string, filename: string, mimeType: string = 'text/csv'): Promise<boolean> {
  try {
    const fileUri = (FileSystem.cacheDirectory || '') + filename;
    await FileSystem.writeAsStringAsync(fileUri, content, { encoding: FileSystem.EncodingType.UTF8 });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType,
        dialogTitle: `Export ${filename}`,
      });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
