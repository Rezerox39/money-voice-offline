import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Trip } from '../types';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../constants';
import { CURRENCIES } from '../types';

interface TripCardProps {
  trip: Trip;
  onPress: () => void;
}

export function TripCard({ trip, onPress }: TripCardProps) {
  const currency = CURRENCIES[trip.currency] || { symbol: '₹', code: 'INR' };
  const totalExpenses = trip.expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name="airplane" size={20} color={COLORS.primary} />
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{trip.name}</Text>
          <Text style={styles.meta}>
            {trip.members.length} members · {trip.expenses.length} expenses
          </Text>
        </View>
      </View>
      <View style={styles.footer}>
        <Text style={styles.amount}>
          {currency.symbol}{totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </Text>
        <Text style={styles.currency}>{trip.currency}</Text>
      </View>
    </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  meta: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  amount: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.primary,
  },
  currency: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
  },
});
