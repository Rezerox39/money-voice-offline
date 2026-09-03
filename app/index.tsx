import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TripCard } from '../src/components/TripCard';
import { EmptyState } from '../src/components/EmptyState';
import { getAllTrips } from '../src/lib/database';
import { Trip } from '../src/types';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../src/constants';
import { useFocusEffect } from 'expo-router';

export default function DashboardScreen() {
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadTrips();
    }, [])
  );

  async function loadTrips() {
    const allTrips = await getAllTrips();
    setTrips(allTrips);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Trips</Text>
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.push('/scan')}
          >
            <Ionicons name="qr-code-outline" size={22} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, styles.primaryBtn]}
            onPress={() => router.push('/trips/new')}
          >
            <Ionicons name="add" size={24} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>

      {trips.length === 0 ? (
        <EmptyState
          icon="airplane-outline"
          title="No trips yet"
          subtitle="Create your first trip to start tracking group expenses, or scan a QR code to import one."
        />
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TripCard trip={item} onPress={() => router.push(`/trips/${item.id}`)} />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZE.xxxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
  },
  list: {
    paddingBottom: SPACING.xxxl,
  },
});
