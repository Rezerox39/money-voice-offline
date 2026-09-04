// ─────────────────────────────────────────────────────────────────
// index.tsx — Dual-Mode Channel Screen (/PERSONAL ↔ /TRIPS)
// BitChat AMOLED monospace interface.
// ─────────────────────────────────────────────────────────────────

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Platform, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLedger } from '../src/context/LedgerContext';
import { useVoiceExpense } from '../src/hooks/useVoiceExpense';
import { VoiceHUD } from '../src/components/VoiceHUD';
import { EmptyState } from '../src/components/EmptyState';
import { Dock } from '../src/components/Dock';
import { ExpenseRow } from '../src/components/ExpenseRow';
import { ExpenseRowSkeleton } from '../src/components/LoadingSkeleton';
import { recordActivity, getStreakData, formatStreak, StreakData } from '../src/lib/streak';
import { computePoolTelemetry } from '../src/lib/debt';
import { CURRENCIES, PersonalExpense } from '../src/types';
import { COLORS, SPACING } from '../src/constants';

// ── ASCII Burn-Down Bar ────────────────────────────────────────────

function BurnBar({ remaining, total }: { remaining: number; total: number }) {
  const pct = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const filled = Math.round(pct * 16);
  const bar = '█'.repeat(filled) + '░'.repeat(16 - filled);
  return <Text style={styles.burnBar}>[{bar}]</Text>;
}

// ── Status Bar ─────────────────────────────────────────────────────

function StatusBar({ streak }: { streak?: StreakData }) {
  return (
    <View style={styles.statusBar}>
      <Text style={styles.statusDot}>●</Text>
      <Text style={styles.statusText}>OFFLINE MESH</Text>
      {streak && streak.currentStreak > 0 && (
        <Text style={styles.streakBadge}>{streak.currentStreak}🔥</Text>
      )}
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

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [streak, setStreak] = useState<StreakData | null>(null);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await refreshActiveData();
      const s = await getStreakData();
      setStreak(s);
      setIsLoading(false);
    })();
  }, []);

  const handleCommit = useCallback(async () => {
    await refreshActiveData();
    await recordActivity();
    const s = await getStreakData();
    setStreak(s);
  }, [refreshActiveData]);

  const voice = useVoiceExpense(activeTrip, handleCommit);

  const voiceState = voice.state;
  const isRecording = voiceState.stage === 'listening' || voiceState.isRecording;

  async function onRefresh() {
    setRefreshing(true);
    await refreshActiveData();
    const s = await getStreakData();
    setStreak(s);
    setRefreshing(false);
  }

  function handleModeSwitch() {
    setMode(mode === 'PERSONAL' ? 'TRIP' : 'PERSONAL');
  }

  function handleSettle() {
    if (activeTripId) router.push(`/settle/${activeTripId}`);
  }

  function handleQR() {
    if (activeTripId) router.push(`/trips/share-qr/${activeTripId}`);
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
              SPENT: {currency.symbol}{poolTelemetry.totalSpentFromPool.toLocaleString('en-IN')} · BURN: {poolTelemetry.burnRatePercent.toFixed(0)}%
            </Text>
          </View>
        )}

        {/* Trip Header */}
        <View style={styles.tripHeader}>
          <Text style={styles.tripChannel}>#{activeTrip.name.toLowerCase().replace(/\s+/g, '-')}</Text>
          <Text style={styles.tripMeta}>
            {activeTrip.members.length} MEMBERS · {activeTrip.expenses.length} TXNS · TOTAL: {currency.symbol}{totalExpenses.toLocaleString('en-IN')}
          </Text>
        </View>

        {/* Expenses */}
        <FlatList
          data={activeTrip.expenses.slice().reverse()}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const payerName = activeTrip.members.find(m => m.id === item.paidBy)?.name || 'Unknown';
            const isPool = item.paidBy === 'POOL';
            return (
              <View style={styles.expenseRow}>
                <View style={styles.expenseInfo}>
                  <Text style={styles.expenseTitle}>
                    {isPool ? '[POOL] ' : ''}{item.title}
                  </Text>
                  <Text style={styles.expenseMeta}>
                    {payerName} · {item.category}
                  </Text>
                </View>
                <Text style={styles.expenseAmount}>
                  {currency.symbol}{item.amount.toLocaleString('en-IN')}
                </Text>
              </View>
            );
          }}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#00FF66"
              colors={['#00FF66']}
            />
          }
        />
      </View>
    );
  }

  // ── Personal Mode ──────────────────────────────────────────────

  function renderPersonalMode() {
    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayExpenses = personalExpenses.filter(e => e.createdAt >= todayStart.getTime());
    const todayTotal = todayExpenses.reduce((s, e) => s + e.amount, 0);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthExpenses = personalExpenses.filter(e => e.createdAt >= monthStart.getTime());
    const monthTotal = monthExpenses.reduce((s, e) => s + e.amount, 0);

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

        {/* Expenses */}
        <FlatList
          data={personalExpenses.slice().reverse()}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.personalRow}>
              <View style={styles.personalInfo}>
                <Text style={styles.personalTitle}>{item.title}</Text>
                <Text style={styles.personalMeta}>
                  {item.category} · {new Date(item.createdAt).toLocaleDateString('en-IN')}
                </Text>
              </View>
              <Text style={styles.personalAmount}>₹{item.amount.toLocaleString('en-IN')}</Text>
            </View>
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              icon="receipt-outline"
              title="No expenses yet"
              subtitle='Say "Chai 30 personal" to start tracking'
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#00FF66"
              colors={['#00FF66']}
            />
          }
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar streak={streak ?? undefined} />

      {/* Mode Bar */}
      <View style={styles.modeBar}>
        <TouchableOpacity onPress={handleModeSwitch} style={styles.modeSwitch}>
          <Text style={styles.modeText}>
            MODE: {mode === 'PERSONAL' ? '/PERSONAL' : `#${activeTrip?.name.toLowerCase().replace(/\s+/g, '-') || 'trip'}`}
          </Text>
          <Ionicons name="swap-horizontal" size={14} color="#FFB000" />
        </TouchableOpacity>
        {mode === 'TRIP' && activeTripId && (
          <TouchableOpacity onPress={handleQR}>
            <Text style={styles.qrBadge}>[QR]</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={{ flex: 1 }}>
          {[1, 2, 3, 4, 5].map(i => <ExpenseRowSkeleton key={i} />)}
        </View>
      ) : (
        <View style={styles.content}>
          {mode === 'TRIP' ? renderTripMode() : renderPersonalMode()}
        </View>
      )}

      {/* Voice FAB */}
      <View style={styles.voiceFab}>
        <TouchableOpacity
          style={[styles.fabInner, isRecording && styles.fabActive]}
          onPress={handleVoicePress}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isRecording ? 'mic' : 'mic-outline'}
            size={24}
            color={isRecording ? '#000000' : '#00FF66'}
          />
        </TouchableOpacity>
      </View>

      {/* Voice HUD */}
      {(voiceState.stage === 'parsed' || voiceState.stage === 'committing') && (
        <VoiceHUD state={voiceState} onCancel={voice.cancelCommit} onConfirm={voice.confirmImmediately} onEdit={() => {}} />
      )}

      {/* Dock */}
      <Dock
        mode={mode}
        activeTripId={activeTripId}
        onSettle={handleSettle}
        onQR={handleQR}
      />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
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
  streakBadge: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#FFB000',
    marginLeft: 'auto',
  },
  modeBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
  },
  modeSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  content: {
    flex: 1,
  },
  modeContainer: {
    flex: 1,
  },
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
  expenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  expenseInfo: { flex: 1, gap: 2 },
  expenseTitle: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: '#E0E0E0',
  },
  expenseMeta: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#555555',
  },
  expenseAmount: {
    fontFamily: 'monospace',
    fontSize: 14,
    color: '#FFB000',
    fontWeight: '700',
  },
  personalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  personalInfo: { flex: 1, gap: 2 },
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
  list: {
    paddingBottom: 160,
  },
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
