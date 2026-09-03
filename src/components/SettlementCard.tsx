import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SettlementTransaction, Member, CURRENCIES } from '../types';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../constants';

interface SettlementCardProps {
  settlement: SettlementTransaction;
  members: Member[];
  currency: string;
}

export function SettlementCard({ settlement, members, currency }: SettlementCardProps) {
  const memberMap = new Map(members.map((m) => [m.id, m]));
  const from = memberMap.get(settlement.from);
  const to = memberMap.get(settlement.to);
  const cur = CURRENCIES[currency] || { symbol: '₹' };

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.member}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{from?.name?.[0] || '?'}</Text>
          </View>
          <Text style={styles.name} numberOfLines={1}>{from?.name || 'Unknown'}</Text>
        </View>

        <View style={styles.arrow}>
          <Ionicons name="arrow-forward" size={20} color={COLORS.primary} />
          <Text style={styles.amount}>
            {cur.symbol}{settlement.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </Text>
        </View>

        <View style={styles.member}>
          <View style={[styles.avatar, styles.avatarGreen]}>
            <Text style={styles.avatarText}>{to?.name?.[0] || '?'}</Text>
          </View>
          <Text style={styles.name} numberOfLines={1}>{to?.name || 'Unknown'}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  member: {
    alignItems: 'center',
    width: 80,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  avatarGreen: {
    backgroundColor: COLORS.success,
  },
  avatarText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.white,
  },
  name: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    textAlign: 'center',
  },
  arrow: {
    alignItems: 'center',
    gap: 4,
  },
  amount: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.primary,
  },
});
