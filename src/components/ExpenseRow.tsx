import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TripExpense, Member, CURRENCIES } from '../types';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../constants';

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Food: 'restaurant',
  Transport: 'car',
  Accommodation: 'bed',
  Shopping: 'bag',
  Entertainment: 'film',
  Utilities: 'flash',
  Other: 'ellipsis-horizontal',
};

interface ExpenseRowProps {
  expense: TripExpense;
  members: Member[];
  currency: string;
  onDelete?: () => void;
}

export function ExpenseRow({ expense, members, currency, onDelete }: ExpenseRowProps) {
  const memberMap = new Map(members.map((m) => [m.id, m]));
  const payer = memberMap.get(expense.paidBy);
  const cur = CURRENCIES[currency] || { symbol: '₹' };
  const icon = CATEGORY_ICONS[expense.category] || 'ellipsis-horizontal';

  return (
    <View style={styles.row}>
      <View style={styles.iconContainer}>
        <Ionicons name={icon} size={18} color={COLORS.primary} />
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{expense.title}</Text>
        <Text style={styles.meta}>
          Paid by {payer?.name || 'Unknown'} · {expense.category}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.amount}>
          {cur.symbol}{expense.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </Text>
        {onDelete && (
          <TouchableOpacity onPress={onDelete} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.md,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: FONT_SIZE.md,
    fontWeight: '500',
    color: COLORS.text,
  },
  meta: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
  },
  amount: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
  },
});
