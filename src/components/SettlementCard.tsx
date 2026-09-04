import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SettlementTransaction, Member, CURRENCIES } from '../types';
import { triggerUPIPayment, formatUPIClipboardText } from '../lib/upiIntent';
import { hapticTick } from '../lib/audioFeedback';
import { SPACING } from '../constants';

interface SettlementCardProps {
  settlement: SettlementTransaction;
  members: Member[];
  currency: string;
  tripName?: string;
}

export function SettlementCard({ settlement, members, currency, tripName }: SettlementCardProps) {
  const memberMap = new Map(members.map((m) => [m.id, m]));
  const from = memberMap.get(settlement.from);
  const to = memberMap.get(settlement.to);
  const cur = CURRENCIES[currency] || { symbol: '₹' };

  const handlePay = async () => {
    if (!to?.upiOrHandle) {
      const text = formatUPIClipboardText({
        payeeAddress: to?.name ?? 'Unknown',
        payeeName: to?.name ?? 'Unknown',
        amount: settlement.amount,
        note: tripName ? `${tripName} Settlement` : 'Trip Settlement',
      });
      await Clipboard.setStringAsync(text);
      await hapticTick();
      Alert.alert('Copied', 'UPI details copied to clipboard.');
      return;
    }

    const result = await triggerUPIPayment({
      payeeAddress: to.upiOrHandle,
      payeeName: to.name,
      amount: settlement.amount,
      note: tripName ? `${tripName} Settlement` : 'Trip Settlement',
    });

    if (!result.success) {
      const text = formatUPIClipboardText({
        payeeAddress: to.upiOrHandle!,
        payeeName: to.name,
        amount: settlement.amount,
        note: tripName ? `${tripName} Settlement` : 'Trip Settlement',
      });
      await Clipboard.setStringAsync(text);
      await hapticTick();
      Alert.alert('No UPI App', result.error ?? 'Details copied to clipboard.');
    }
  };

  return (
    <View style={styles.card}>
      {/* Terminal-style settlement line */}
      <View style={styles.row}>
        <Text style={styles.fromName}>{from?.name || '?'}</Text>
        <Text style={styles.dashLine}>────</Text>
        <Text style={styles.amount}>
          {cur.symbol}{settlement.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </Text>
        <Text style={styles.dashLine}>────</Text>
        <Text style={styles.toName}>{to?.name || '?'}</Text>
      </View>

      {/* UPI Pay Button */}
      {to?.upiOrHandle && Platform.OS === 'android' ? (
        <TouchableOpacity style={styles.payBtn} onPress={handlePay}>
          <Text style={styles.payBtnText}>
            ⚡ PAY {cur.symbol}{settlement.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} VIA UPI
          </Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.copyBtn} onPress={handlePay}>
          <Text style={styles.copyBtnText}>📋 COPY UPI DETAILS</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0A0A0A',
    borderRadius: 4,
    padding: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#222222',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  fromName: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#FF3333',
    fontWeight: '700',
  },
  dashLine: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#555555',
  },
  amount: {
    fontFamily: 'monospace',
    fontSize: 14,
    color: '#FFB000',
    fontWeight: '700',
  },
  toName: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#00FF66',
    fontWeight: '700',
  },
  payBtn: {
    marginTop: SPACING.sm,
    backgroundColor: '#001A0D',
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#00FF66',
  },
  payBtnText: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '700',
    color: '#00FF66',
  },
  copyBtn: {
    marginTop: SPACING.sm,
    backgroundColor: '#1F1F1F',
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  copyBtnText: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '600',
    color: '#888888',
  },
});
