// ─────────────────────────────────────────────────────────────────
// index.tsx — Dual-Mode Channel Screen (/PERSONAL ↔ /TRIPS)
// BitChat AMOLED monospace interface.
// ─────────────────────────────────────────────────────────────────

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLedger, ActiveMode } from '../src/context/LedgerContext';
import { useVoiceExpense } from '../src/hooks/useVoiceExpense';
import { VoiceHUD } from '../src/components/VoiceHUD';
import { EmptyState } from '../src/components/EmptyState';
import { ExpenseRow } from '../src/components/ExpenseRow';
import { addPersonalExpense } from '../src/lib/database';
import { computePoolTelemetry } from '../src/lib/debt';
import { CURRENCIES, TripExpense, PersonalExpense } from '../src/types';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../src/constants';

// ── ASCII Burn-Down Bar ────────────────────────────────────────────

function BurnBar({ remaining, total }: { remaining: number; total: number }) {
  const pct = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const filled = Math.round(pct * 16);
  const bar = '█'.repeat(filled) + '░'.repeat(16 - filled);
  return <Text style={styles.burnBar}>[{bar}]</Text>;
}

// ── Status Bar ─────────────────────────────────────────────────────

function StatusBar() {
  return (
    <View style={styles.statusBar}>
      <Text style={styles.statusDot}>●</Text>
      <Text style={styles.statusText}>OFFLINE MESH</Text>
    </View>
  );
}

// ── Dock ───────────────────────────────────────────────────────────

function Dock({
  mode,
  onModeSwitch,
  onSettle,
  onQR,
  isRecording,
}: {
  mode: ActiveMode;
  onModeSwitch: () => void;
  onSettle: () => void;
  onQR: () => void;
  isRecording: boolean;
}) {
  return (
    <View style={styles.dock}>
      <TouchableOpacity style={styles.dockBtn} onPress={onModeSwitch}>
        <Text style={styles.dockBtnText}>
          {mode === 'PERSONAL' ? '[/personal]' : '[/trips]'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.dockBtnCenter} onPress={() => {}}>
        <Text style={[styles.dockBtnText, isRecording && styles.recActive]}>
          {isRecording ? '( ( ( ● REC ) ) )' : '( ( ( ○ ) ) )'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.dockBtn} onPress={onSettle}>
        <Text style={styles.dockBtnText}>[$ SETTLE]</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────

export default function ChannelScreen() {
  const router = useRouter();
  const {
    mode,
    setMode,
    activeTrip,
    activeTripId,
    personalExpenses,
    allTrips,
    refreshActiveData,
  } = useLedger();

  const handleCommit = useCallback(() => {
    refreshActiveData();
  }, [refreshActiveData]);

  const voice = useVoiceExpense(activeTrip, handleCommit);

  const voiceState = voice.state;
  const isRecording = voiceState.stage === 'listening' || voiceState.isRecording;

  function handleModeSwitch() {
    setMode(mode === 'PERSONAL' ? 'TRIP' : 'PERSONAL');
  }

  function handleSettle() {
    if (activeTripId) {
      router.push(`/settle/${activeTripId}`);
    }
  }

  function handleQR() {
    if (activeTripId) {
      router.push(`/trips/share-qr/${activeTripId}`);
    }
  }

  function handleVoicePress() {
    if (voiceState.stage === 'listening' || voiceState.isRecording) {
      voice.stopRecording();
    } else if (voiceState.stage === 'idle' || voiceState.stage === 'error') {
      voice.startRecording();
    }
  }

  // ── Trip Mode ──────────────────────────────────────────────────

  function renderTripMode() {
    if (!activeTrip) {
      return (
        <EmptyState
          icon="airplane-outline"
          title="No active trip"
          subtitle='Say "Switch to [trip name]" or create a new trip'
        />
      );
    }

    const currency = CURRENCIES[activeTrip.currency] || { symbol: '₹' };
    const totalExpenses = activeTrip.expenses.reduce((s, e) => s + e.amount, 0);
    const poolDeps = (activeTrip as any).poolDeposits || [];
    const poolTelemetry = computePoolTelemetry(poolDeps, activeTrip.expenses);

    return (
      <View style={styles.modeContainer}>
        {/* Pool Burn-Down */}
        {poolTelemetry.totalDeposited > 0 && (
          <View style={styles.poolSection}>
            <View style={styles.poolHeader}>
              <Text style={styles.poolLabel}>KITTY POOL</Text>
              <Text style={styles.poolAmount}>
                {currency.symbol}{poolTelemetry.remainingBalance.toLocaleString('en-IN')}
              </Text>
            </View>
            <BurnBar
              remaining={poolTelemetry.remainingBalance}
              total={poolTelemetry.totalDeposited}
            />
            <Text style={styles.poolMeta}>
              {poolTelemetry.burnRatePercent.toFixed(0)}% spent · {poolTelemetry.totalDeposited.toLocaleString('en-IN')} deposited
            </Text>
          </View>
        )}

        {/* Trip Header */}
        <View style={styles.tripHeader}>
          <Text style={styles.tripChannel}>
            #{activeTrip.name.toLowerCase().replace(/\s+/g, '-')}
          </Text>
          <Text style={styles.tripMeta}>
            {activeTrip.members.length} members · {currency.symbol}{totalExpenses.toLocaleString('en-IN')} total
          </Text>
        </View>

        {/* Expense Timeline */}
        {activeTrip.expenses.length === 0 ? (
          <EmptyState
            icon="receipt-outline"
            title="No expenses yet"
            subtitle='Say "Dinner 1200 split with all"'
          />
        ) : (
          <FlatList
            data={activeTrip.expenses}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ExpenseRow
                expense={item}
                members={activeTrip.members}
                currency={activeTrip.currency}
              />
            )}
            contentContainerStyle={styles.list}
          />
        )}
      </View>
    );
  }

  // ── Personal Mode ─────────────────────────────────────────────

  function renderPersonalMode() {
    const todayTotal = personalExpenses
      .filter((e) => {
        const d = new Date(e.createdAt);
        const now = new Date();
        return d.toDateString() === now.toDateString();
      })
      .reduce((s, e) => s + e.amount, 0);

    const monthTotal = personalExpenses
      .filter((e) => {
        const d = new Date(e.createdAt);
        const now = new Date();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((s, e) => s + e.amount, 0);

    return (
      <View style={styles.modeContainer}>
        {/* Burn Summary */}
        <View style={styles.burnSummary}>
          <View style={styles.burnRow}>
            <Text style={styles.burnLabel}>TODAY</Text>
            <Text style={styles.burnAmount}>₹{todayTotal.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.burnDivider} />
          <View style={styles.burnRow}>
            <Text style={styles.burnLabel}>THIS MONTH</Text>
            <Text style={styles.burnAmountAccent}>₹{monthTotal.toLocaleString('en-IN')}</Text>
          </View>
        </View>

        {/* Personal Expense Log */}
        {personalExpenses.length === 0 ? (
          <EmptyState
            icon="person-outline"
            title="No personal expenses"
            subtitle='Say "Chai 30" or "Petrol 500 card"'
          />
        ) : (
          <FlatList
            data={personalExpenses}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.personalRow}>
                <View style={styles.personalInfo}>
                  <Text style={styles.personalTitle}>{item.title}</Text>
                  <Text style={styles.personalMeta}>
                    {item.category} · {new Date(item.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <Text style={styles.personalAmount}>₹{item.amount.toLocaleString('en-IN')}</Text>
              </View>
            )}
            contentContainerStyle={styles.list}
          />
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Status Bar */}
      <StatusBar />

      {/* Mode Indicator */}
      <View style={styles.modeBar}>
        <Text style={styles.modeText}>
          MODE: {mode === 'PERSONAL' ? '/PERSONAL' : `#${activeTrip?.name?.toLowerCase().replace(/\s+/g, '-') || 'NO-TRIP'}`}
        </Text>
        {mode === 'TRIP' && (
          <TouchableOpacity onPress={handleQR}>
            <Text style={styles.qrBadge}>[QR]</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {mode === 'PERSONAL' ? renderPersonalMode() : renderTripMode()}
      </View>

      {/* Voice HUD Overlay */}
      <VoiceHUD
        state={voiceState}
        onCancel={voice.cancelCommit}
        onConfirm={voice.confirmImmediately}
        onEdit={voice.cancelCommit}
      />

      {/* Bottom Dock */}
      <Dock
        mode={mode}
        onModeSwitch={handleModeSwitch}
        onSettle={handleSettle}
        onQR={handleQR}
        isRecording={isRecording}
      />

      {/* Voice FAB (centered in dock area) */}
      <TouchableOpacity
        style={styles.voiceFab}
        onPress={handleVoicePress}
        activeOpacity={0.7}
      >
        <View style={[styles.fabInner, isRecording && styles.fabActive]}>
          <Ionicons
            name={isRecording ? 'mic' : 'mic-outline'}
            size={28}
            color={isRecording ? '#000000' : '#00FF66'}
          />
        </View>
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  // Status Bar
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.lg,
    paddingTop: Platform.OS === 'android' ? SPACING.xxxl : SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  statusDot: {
    fontSize: 10,
    color: '#00FF66',
  },
  statusText: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#00FF66',
    letterSpacing: 1,
  },
  // Mode Bar
  modeBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
  },
  modeText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#FFB000',
    letterSpacing: 0.5,
  },
  qrBadge: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#00FF66',
    fontWeight: '700',
  },
  // Content
  content: {
    flex: 1,
  },
  modeContainer: {
    flex: 1,
  },
  // Pool Section
  poolSection: {
    backgroundColor: '#0A0A0A',
    margin: SPACING.lg,
    borderRadius: 4,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#222222',
  },
  poolHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  poolLabel: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#FFB000',
    fontWeight: '700',
    letterSpacing: 1,
  },
  poolAmount: {
    fontFamily: 'monospace',
    fontSize: 14,
    color: '#00FF66',
    fontWeight: '700',
  },
  burnBar: {
    fontFamily: 'monospace',
    fontSize: 14,
    color: '#00FF66',
    letterSpacing: 1,
  },
  poolMeta: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#555555',
    marginTop: SPACING.xs,
  },
  // Trip Header
  tripHeader: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
  },
  tripChannel: {
    fontFamily: 'monospace',
    fontSize: 16,
    color: '#00FF66',
    fontWeight: '700',
  },
  tripMeta: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#555555',
    marginTop: 2,
  },
  // Burn Summary (Personal)
  burnSummary: {
    flexDirection: 'row',
    margin: SPACING.lg,
    backgroundColor: '#0A0A0A',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#222222',
  },
  burnRow: {
    flex: 1,
    alignItems: 'center',
    padding: SPACING.md,
    gap: 4,
  },
  burnDivider: {
    width: 1,
    backgroundColor: '#222222',
  },
  burnLabel: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#555555',
    letterSpacing: 1,
  },
  burnAmount: {
    fontFamily: 'monospace',
    fontSize: 16,
    color: '#00FF66',
    fontWeight: '700',
  },
  burnAmountAccent: {
    fontFamily: 'monospace',
    fontSize: 16,
    color: '#FFB000',
    fontWeight: '700',
  },
  // Personal Rows
  personalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  personalInfo: {
    flex: 1,
    gap: 2,
  },
  personalTitle: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: '#E0E0E0',
  },
  personalMeta: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#555555',
  },
  personalAmount: {
    fontFamily: 'monospace',
    fontSize: 14,
    color: '#FFB000',
    fontWeight: '700',
  },
  // List
  list: {
    paddingBottom: 160,
  },
  // Dock
  dock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    paddingBottom: Platform.OS === 'android' ? SPACING.xl : SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#222222',
    backgroundColor: '#0A0A0A',
  },
  dockBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  dockBtnText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#888888',
    letterSpacing: 0.5,
  },
  dockBtnCenter: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  recActive: {
    color: '#FF3333',
  },
  // Voice FAB
  voiceFab: {
    position: 'absolute',
    bottom: Platform.OS === 'android' ? 56 : 48,
    alignSelf: 'center',
    zIndex: 50,
  },
  fabInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1F1F1F',
    borderWidth: 2,
    borderColor: '#00FF66',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabActive: {
    backgroundColor: '#00FF66',
    borderColor: '#00FF66',
  },
});
