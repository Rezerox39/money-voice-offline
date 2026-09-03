import * as Sharing from 'expo-sharing';
import { Trip, Member, SettlementTransaction } from '../types';
import { simplifyDebts } from './debt';
import { CURRENCIES } from '../types';

export function formatSettlementText(
  trip: Trip,
  settlements: SettlementTransaction[]
): string {
  const memberMap = new Map<string, Member>();
  trip.members.forEach((m) => memberMap.set(m.id, m));

  const currency = CURRENCIES[trip.currency] || { symbol: '₹', code: 'INR' };

  const totalExpenses = trip.expenses.reduce((sum, e) => sum + e.amount, 0);

  let text = `🏖️ *${trip.name} Settlement Breakdown*\n`;
  text += `Total Expenses: ${currency.symbol}${totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n\n`;
  text += `*Settlement Instructions:*\n`;

  if (settlements.length === 0) {
    text += `✅ All settled! No payments needed.\n`;
  } else {
    for (const s of settlements) {
      const fromMember = memberMap.get(s.from);
      const toMember = memberMap.get(s.to);
      if (!fromMember || !toMember) continue;

      const upiHint = toMember.upiOrHandle
        ? ` (UPI: ${toMember.upiOrHandle})`
        : '';
      text += `• ${fromMember.name} owes ${toMember.name}: ${currency.symbol}${s.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}${upiHint}\n`;
    }
  }

  text += `\n_Generated locally via Money Voice._`;
  return text;
}

export async function shareSettlement(
  trip: Trip,
  settlements: SettlementTransaction[]
): Promise<boolean> {
  const text = formatSettlementText(trip, settlements);
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync('data:text/plain;charset=utf-8,' + encodeURIComponent(text), {
      mimeType: 'text/plain',
      dialogTitle: `Share ${trip.name} settlement`,
      UTI: 'public.plain-text',
    });
    return true;
  }
  return false;
}
