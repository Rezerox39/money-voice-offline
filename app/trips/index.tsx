import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { getAllTrips } from '../../src/lib/database';
import { useLedger } from '../../src/context/LedgerContext';
import { EmptyState } from '../../src/components/EmptyState';
import { Trip, CURRENCIES } from '../../src/types';
import { computePoolTelemetry } from '../../src/lib/debt';

export default function TripsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setActiveTripId, refreshTrips } = useLedger();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadTrips();
    }, [])
  );

  async function loadTrips() {
    setIsLoading(true);
    try {
      const all = await getAllTrips();
      setTrips(Array.isArray(all) ? all : []);
    } catch (err) {
      console.warn('[DB_RECOVERY] loadTrips failed:', err);
      setTrips([]);
    }
    setIsLoading(false);
  }

  function handleSelectTrip(trip: Trip) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setActiveTripId(trip.id);
    router.push(`/trips/${trip.id}`);
  }

  function handleCreateTrip() {
    Haptics.selectionAsync();
    router.push('/trips/new');
  }

  function handleJoinTrip() {
    Haptics.selectionAsync();
    router.push('/trips/join');
  }

  function renderTrip({ item }: { item: Trip }) {
    const currency = CURRENCIES[item.currency] || { symbol: '₹' };
    const totalExpenses = item.expenses.reduce((s, e) => s + e.amount, 0);
    const poolDeps = (item as any).poolDeposits || [];
    const poolTelemetry = computePoolTelemetry(poolDeps, item.expenses);

    return (
      <TouchableOpacity style={styles.tripCard} onPress={() => handleSelectTrip(item)} activeOpacity={0.7}>
        <View style={styles.tripHeader}>
          <View style={styles.tripNameRow}>
            <Text style={styles.tripHash}>#</Text>
            <Text style={styles.tripName}>{item.name.toLowerCase().replace(/\s+/g, '-')}</Text>
          </View>
          <Text style={styles.tripMembers}>
            <Ionicons name="people" size={12} color="#888888" /> {item.members.length}
          </Text>
        </View>

        <View style={styles.tripStats}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>SPENT</Text>
            <Text style={styles.statValue}>{currency.symbol}{totalExpenses.toLocaleString('en-IN')}</Text>
          </View>
          {poolTelemetry.totalDeposited > 0 && (
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>POOL</Text>
              <Text style={[styles.statValue, { color: '#00FF66' }]}>
                {currency.symbol}{poolTelemetry.remainingBalance.toLocaleString('en-IN')}
              </Text>
            </View>
          )}
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>TXNS</Text>
            <Text style={styles.statValue}>{item.expenses.length}</Text>
          </View>
        </View>

        <View style={styles.tripFooterRow}>
          <Text style={styles.tripDate}>
            {new Date(item.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
          <TouchableOpacity
            style={styles.inviteLink}
            onPress={() => router.push(`/trips/invite?id=${item.id}`)}
          >
            <Ionicons name="person-add-outline" size={12} color="#FFB000" />
            <Text style={styles.inviteLinkText}>INVITE</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 24) }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>{'<< BACK'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>TRIP HUB</Text>
        <TouchableOpacity onPress={handleCreateTrip} style={styles.addBtn}>
          <Ionicons name="add" size={20} color="#00FF66" />
        </TouchableOpacity>
      </View>

      {/* Trip List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading trips...</Text>
        </View>
      ) : trips.length === 0 ? (
        <EmptyState
          icon="airplane-outline"
          title="No trips yet"
          subtitle='Create a trip or tap "LOAD SAMPLE PLAYGROUND" in onboarding'
        />
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(item) => item.id}
          renderItem={renderTrip}
          contentContainerStyle={styles.list}
        />
      )}

      {/* Create & Join Buttons */}
      {!isLoading && (
        <View style={styles.bottomActions}>
          <TouchableOpacity style={styles.joinBtn} onPress={handleJoinTrip}>
            <Ionicons name="qr-code-outline" size={20} color="#00FF66" />
            <Text style={styles.joinBtnText}>JOIN GROUP</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.createBtn} onPress={handleCreateTrip}>
            <Ionicons name="add-circle" size={20} color="#000000" />
            <Text style={styles.createBtnText}>CREATE TRIP</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#222222',
  },
  backBtn: { padding: 4 },
  backText: { fontFamily: 'monospace', fontSize: 12, color: '#00FF66', letterSpacing: 1 },
  headerTitle: { fontFamily: 'monospace', fontSize: 16, color: '#00FF66', fontWeight: '700', letterSpacing: 2 },
  addBtn: { padding: 4 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontFamily: 'monospace', fontSize: 13, color: '#555555' },
  list: { padding: 16, paddingBottom: 100 },
  tripCard: {
    backgroundColor: '#0A0A0A', borderRadius: 6, padding: 16,
    borderWidth: 1, borderColor: '#222222', marginBottom: 12,
  },
  tripHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  tripNameRow: { flexDirection: 'row', alignItems: 'center' },
  tripHash: { fontFamily: 'monospace', fontSize: 18, color: '#FFB000', fontWeight: '700', marginRight: 4 },
  tripName: { fontFamily: 'monospace', fontSize: 16, color: '#E0E0E0', fontWeight: '700' },
  tripMembers: { fontFamily: 'monospace', fontSize: 11, color: '#888888' },
  tripStats: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  statItem: { gap: 2 },
  statLabel: { fontFamily: 'monospace', fontSize: 9, color: '#555555', letterSpacing: 1 },
  statValue: { fontFamily: 'monospace', fontSize: 13, color: '#FFB000', fontWeight: '700' },
  tripFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tripDate: { fontFamily: 'monospace', fontSize: 10, color: '#333333' },
  inviteLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  inviteLinkText: { fontFamily: 'monospace', fontSize: 10, color: '#FFB000', fontWeight: '700', letterSpacing: 0.5 },
  bottomActions: {
    flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 24, paddingTop: 4,
  },
  joinBtn: {
    flex: 1,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    backgroundColor: '#0A0A0A', borderRadius: 6, paddingVertical: 14,
    borderWidth: 1, borderColor: '#00FF66',
  },
  joinBtnText: { fontFamily: 'monospace', fontSize: 12, color: '#00FF66', fontWeight: '700', letterSpacing: 0.5 },
  createBtn: {
    flex: 1,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    backgroundColor: '#00FF66', borderRadius: 6, paddingVertical: 14,
  },
  createBtnText: { fontFamily: 'monospace', fontSize: 12, color: '#000000', fontWeight: '700', letterSpacing: 0.5 },
});
