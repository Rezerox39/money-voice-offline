// ─────────────────────────────────────────────────────────────────
// [tripId].tsx — AMOLED Terminal Settlement Screen
// [▶ SPEAK SETTLEMENT] + [⚡ PAY VIA UPI] per settlement line.
// ─────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SettlementCard } from '../../src/components/SettlementCard';
import { EmptyState } from '../../src/components/EmptyState';
import { getTripById } from '../../src/lib/database';
import { simplifyDebts } from '../../src/lib/debt';
import { shareSettlement } from '../../src/lib/settlement';
import { computeBalances } from '../../src/lib/debt';
import { speakSettlementSummary, stopSpeaking } from '../../src/lib/speechSynthesis';
import { Trip, CURRENCIES } from '../../src/types';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../src/constants';

export default function SettlementScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadTrip();
      return () => { stopSpeaking(); setIsSpeaking(false); };
    }, [tripId])
  );

  async function loadTrip() {
    if (!tripId) return;
    const t = await getTripById(tripId);
    setTrip(t);
  }

  async function handleSpeakSettlement() {
    if (!trip) return;
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
      return;
    }
    const settlements = simplifyDebts(trip.members, trip.expenses);
    const totalExpenses = trip.expenses.reduce((s, e) => s + e.amount, 0);
    const memberMap = new Map(trip.members.map((m) => [m.id, m.name]));
    setIsSpeaking(true);
    try {
      await speakSettlementSummary(trip.name, totalExpenses, settlements, memberMap);
    } finally {
      setIsSpeaking(false);
    }
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

  return (
    <View style={styles.container}>
      {/* Terminal Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>{'<< '}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SETTLE</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Balance Matrix */}
      <View style={styles.balanceSection}>
        <Text style={styles.sectionLabel}>NET BALANCES</Text>
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
                  isPositive && styles.positive,
                  isNegative && styles.negative,
                ]}
              >
                {isPositive ? '+' : ''}{currency.symbol}{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Settlements Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>SETTLEMENTS ({settlements.length})</Text>
        {settlements.length > 0 && (
          <TouchableOpacity
            style={[styles.speakBtn, isSpeaking && styles.speakActive]}
            onPress={handleSpeakSettlement}
          >
            <Ionicons
              name={isSpeaking ? 'stop-circle' : 'volume-high'}
              size={14}
              color={isSpeaking ? '#FF3333' : '#00FF66'}
            />
            <Text style={[styles.speakText, isSpeaking && styles.speakTextActive]}>
              {isSpeaking ? 'STOP' : '▶ SPEAK'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

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
              tripName={trip.name}
            />
          )}
          contentContainerStyle={styles.list}
        />
      )}

      {/* WhatsApp Share */}
      {settlements.length > 0 && (
        <TouchableOpacity
          style={styles.shareBtn}
          onPress={() => shareSettlement(trip, settlements)}
        >
          <Text style={styles.shareBtnText}>💬 SHARE ON WHATSAPP</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  loading: { color: '#555555', textAlign: 'center', marginTop: SPACING.xxxl, fontFamily: 'monospace' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingTop: Platform.OS === 'android' ? SPACING.xxxl : SPACING.lg,
    paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: '#222222',
  },
  backBtn: { padding: 8 },
  backText: { fontFamily: 'monospace', fontSize: 14, color: '#00FF66' },
  headerTitle: { fontFamily: 'monospace', fontSize: 16, color: '#00FF66', fontWeight: '700', letterSpacing: 2 },
  balanceSection: {
    backgroundColor: '#0A0A0A', margin: SPACING.lg, borderRadius: 4,
    padding: SPACING.md, borderWidth: 1, borderColor: '#222222',
  },
  balanceRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 4,
  },
  balanceName: { fontFamily: 'monospace', fontSize: 12, color: '#E0E0E0' },
  balanceAmount: { fontFamily: 'monospace', fontSize: 12, color: '#555555', fontWeight: '600' },
  positive: { color: '#00FF66' },
  negative: { color: '#FF3333' },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md,
  },
  sectionLabel: { fontFamily: 'monospace', fontSize: 11, color: '#FFB000', letterSpacing: 1, fontWeight: '700' },
  speakBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#003311', borderRadius: 4, paddingVertical: 4, paddingHorizontal: 10,
    borderWidth: 1, borderColor: '#00FF66',
  },
  speakActive: { backgroundColor: '#330000', borderColor: '#FF3333' },
  speakText: { fontFamily: 'monospace', fontSize: 10, color: '#00FF66', fontWeight: '700' },
  speakTextActive: { color: '#FF3333' },
  list: { paddingBottom: 100 },
  shareBtn: {
    position: 'absolute', bottom: SPACING.xl, left: SPACING.lg, right: SPACING.lg,
    backgroundColor: '#1F1F1F', borderRadius: 4, paddingVertical: SPACING.md,
    borderWidth: 1, borderColor: '#00FF66', alignItems: 'center',
  },
  shareBtnText: { fontFamily: 'monospace', fontSize: 13, color: '#00FF66', fontWeight: '700' },
});
