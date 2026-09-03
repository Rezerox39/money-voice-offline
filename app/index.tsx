import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TripCard } from '../src/components/TripCard';
import { EmptyState } from '../src/components/EmptyState';
import { VoiceFAB } from '../src/components/VoiceFAB';
import { SafetyWindow } from '../src/components/SafetyWindow';
import { useVoiceEngine } from '../src/hooks/useVoiceEngine';
import { getAllTrips } from '../src/lib/database';
import { Trip } from '../src/types';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../src/constants';
import { useFocusEffect } from 'expo-router';

export default function DashboardScreen() {
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);

  const voice = useVoiceEngine({
    activeTrip,
    onNavigate: (route) => {
      if (route.startsWith('/settle')) {
        if (activeTrip) router.push(`/settle/${activeTrip.id}`);
      } else if (route.startsWith('/trips/qr')) {
        if (activeTrip) router.push(`/trips/share-qr/${activeTrip.id}`);
      } else {
        router.push(route as any);
      }
    },
    onRefresh: loadTrips,
  });

  useFocusEffect(
    useCallback(() => {
      loadTrips();
    }, [])
  );

  async function loadTrips() {
    const allTrips = await getAllTrips();
    setTrips(allTrips);
    // Auto-select first trip as active if none selected
    if (!activeTrip && allTrips.length > 0) {
      setActiveTrip(allTrips[0]);
    }
  }

  function handleVoicePress() {
    if (voice.state === 'listening') {
      voice.stopListening();
    } else if (voice.state === 'idle' || voice.state === 'error') {
      voice.startListening();
    }
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Money Voice</Text>
          {activeTrip && (
            <Text style={styles.activeTrip}>
              #{activeTrip.name.toLowerCase().replace(/\s+/g, '-')}
            </Text>
          )}
        </View>
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

      {/* Voice status display */}
      {voice.displayText ? (
        <View style={styles.voiceStatus}>
          <Text style={styles.voiceStatusText} numberOfLines={2}>
            {voice.displayText}
          </Text>
        </View>
      ) : null}

      {/* Error display */}
      {voice.error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{voice.error}</Text>
        </View>
      ) : null}

      {/* Trip list */}
      {trips.length === 0 ? (
        <EmptyState
          icon="airplane-outline"
          title="No trips yet"
          subtitle='Create your first trip or tap [REC] and say "New trip Goa weekend"'
        />
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TripCard
              trip={item}
              onPress={() => {
                setActiveTrip(item);
                router.push(`/trips/${item.id}`);
              }}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Safety Window Overlay */}
      <SafetyWindow
        visible={voice.state === 'confirming' && !!voice.pendingEntry}
        displayText={voice.pendingEntry?.parsedDisplay ?? ''}
        rawTranscript={voice.pendingEntry?.rawTranscript ?? ''}
        onConfirm={voice.confirmPending}
        onEdit={voice.editPending}
        onCancel={voice.cancelPending}
      />

      {/* Voice FAB — Bottom Right */}
      <View style={styles.fabContainer}>
        <VoiceFAB
          state={voice.state}
          onPress={handleVoicePress}
        />
      </View>
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
  activeTrip: {
    fontFamily: 'monospace',
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    marginTop: 2,
    letterSpacing: 0.5,
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
  voiceStatus: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  voiceStatusText: {
    fontFamily: 'monospace',
    fontSize: FONT_SIZE.sm,
    color: COLORS.success,
    lineHeight: 18,
  },
  errorBanner: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  errorText: {
    fontFamily: 'monospace',
    fontSize: FONT_SIZE.sm,
    color: COLORS.danger,
  },
  list: {
    paddingBottom: 120,
  },
  fabContainer: {
    position: 'absolute',
    bottom: SPACING.xl,
    right: SPACING.xl,
    zIndex: 50,
  },
});
