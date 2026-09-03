import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SettlementCard } from '../../src/components/SettlementCard';
import { EmptyState } from '../../src/components/EmptyState';
import { getTripById } from '../../src/lib/database';
import { simplifyDebts } from '../../src/lib/debt';
import { shareSettlement } from '../../src/lib/settlement';
import { computeBalances } from '../../src/lib/debt';
import { Trip, CURRENCIES } from '../../src/types';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../src/constants';

export default function SettlementScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadTrip();
    }, [tripId])
  );

  async function loadTrip() {
    if (!tripId) return;
    const t = await getTripById(tripId);
    setTrip(t);
  }

  if (!trip) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Loading...</Text>
      </View>
    );
  }

  const settlements = simplifyDebts(trip.members, trip.expenses);
  const balances = computeBalances(trip.members, trip.expenses);
  const currency = CURRENCIES[trip.currency] || { symbol: '₹', code: 'INR' };
  const memberMap = new Map(trip.members.map((m) => [m.id, m]));

  return (
    <View style={styles.container}>
      {/* Balance Summary */}
      <View style={styles.balanceSection}>
        <Text style={styles.balanceTitle}>Net Balances</Text>
        {trip.members.map((m) => {
          const balance = balances.get(m.id) || 0;
          const isPositive = balance > 0.01;
          const isNegative = balance < -0.01;
          return (
            <View key={m.id} style={styles.balanceRow}>
              <Text style={styles.balanceName}>{m.name}</Text>
              <Text
                style={[
                  styles.balanceAmount,
                  isPositive && styles.balancePositive,
                  isNegative && styles.balanceNegative,
                ]}
              >
                {isPositive ? '+' : ''}
                {currency.symbol}
                {balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Settlements */}
      <Text style={styles.sectionTitle}>Settlements ({settlements.length})</Text>

      {settlements.length === 0 ? (
        <EmptyState
          icon="checkmark-circle-outline"
          title="All settled!"
          subtitle="No payments needed between members."
        />
      ) : (
        <FlatList
          data={settlements}
          keyExtractor={(item, i) => `${item.from}-${item.to}-${i}`}
          renderItem={({ item }) => (
            <SettlementCard
              settlement={item}
              members={trip.members}
              currency={trip.currency}
            />
          )}
          contentContainerStyle={styles.list}
        />
      )}

      {/* Share Button */}
      {settlements.length > 0 && (
        <TouchableOpacity
          style={styles.shareBtn}
          onPress={() => shareSettlement(trip, settlements)}
        >
          <Ionicons name="logo-whatsapp" size={20} color={COLORS.white} />
          <Text style={styles.shareBtnText}>Share via WhatsApp</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  loading: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xxxl,
  },
  balanceSection: {
    backgroundColor: COLORS.surface,
    margin: SPACING.lg,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
  },
  balanceTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  balanceName: {
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
  },
  balanceAmount: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  balancePositive: {
    color: COLORS.success,
  },
  balanceNegative: {
    color: COLORS.danger,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  list: {
    paddingBottom: 100,
  },
  shareBtn: {
    position: 'absolute',
    bottom: SPACING.xl,
    left: SPACING.lg,
    right: SPACING.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#25D366',
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.lg,
  },
  shareBtnText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
  },
});
