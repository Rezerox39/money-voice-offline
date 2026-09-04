import { PersonalExpense, Trip, TripExpense, CURRENCIES } from '../types';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export function expensesToCSV(expenses: PersonalExpense[], currency: string = 'INR'): string {
  const sym = CURRENCIES[currency]?.symbol || '₹';
  const header = 'Date,Title,Category,Amount\n';
  const rows = expenses.map(e => {
    const date = new Date(e.createdAt).toLocaleDateString('en-IN');
    return `${date},"${e.title.replace(/"/g, '""')}",${e.category},${sym}${e.amount.toFixed(2)}`;
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

export function generateShareText(
  expenses: PersonalExpense[],
  currency: string,
  title: string = 'Expenses',
): string {
  const sym = CURRENCIES[currency]?.symbol || '₹';
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  let text = `📊 *${title}*\nTotal: ${sym}${total.toFixed(2)}\n\n`;

  const byCategory: Record<string, number> = {};
  for (const e of expenses) {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
  }

  for (const [cat, amt] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
    text += `• ${cat}: ${sym}${amt.toFixed(2)}\n`;
  }

  text += '\n_Generated via Money Voice._';
  return text;
}
