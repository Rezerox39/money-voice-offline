import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet,
  Alert, ScrollView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ExpenseRow } from '../../src/components/ExpenseRow';
import { EmptyState } from '../../src/components/EmptyState';
import { P2PSyncModal } from '../../src/components/P2PSyncModal';
import {
  getTripById, addMember, deleteTrip, deleteExpense, addPoolDeposit,
} from '../../src/lib/database';
import { simplifyDebts, computePoolTelemetry } from '../../src/lib/debt';
import { useAutoSync } from '../../src/hooks/useAutoSync';
import { registerPeerByIP, getDeviceLANIP } from '../../src/lib/lanSync';
import { Trip, CURRENCIES, PoolDeposit } from '../../src/types';

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [newMemberName, setNewMemberName] = useState('');
  const [showMemberInput, setShowMemberInput] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showPoolDeposit, setShowPoolDeposit] = useState(false);
  const [poolAmount, setPoolAmount] = useState('');
  const [showPeerInput, setShowPeerInput] = useState(false);
  const [peerIP, setPeerIP] = useState('');
  const [ownIP, setOwnIP] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadTrip();
    }, [id])
  );

  async function loadTrip() {
    if (!id) return;
    try {
      const t = await getTripById(id);
      setTrip(t);
    } catch (err) {
      console.warn('[DB_RECOVERY] loadTrip failed:', err);
    }
  }

  const autoSync = useAutoSync(id ?? null);

  useEffect(() => {
    getDeviceLANIP().then(setOwnIP);
  }, []);

  async function handleAddMember() {
    if (!newMemberName.trim() || !id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await addMember(id, newMemberName.trim());
    setNewMemberName('');
    setShowMemberInput(false);
    loadTrip();
  }

  async function handlePoolDeposit() {
    if (!id || !trip || !poolAmount) return;
    const amt = parseFloat(poolAmount);
    if (isNaN(amt) || amt <= 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    const memberId = trip.members[0]?.id;
    if (!memberId) return;
    await addPoolDeposit(id, memberId, amt);
    setPoolAmount('');
    setShowPoolDeposit(false);
    loadTrip();
  }

  async function handleAddPeer() {
    const ip = peerIP.trim();
    if (!ip) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await registerPeerByIP(ip);
    setPeerIP('');
    setShowPeerInput(false);
    autoSync.registerPeer(ip);
    loadTrip();
  }

  async function handleDeleteExpense(expenseId: string) {
    Alert.alert('Delete Expense', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteExpense(expenseId); loadTrip(); } },
    ]);
  }

  async function handleDeleteTrip() {
    Alert.alert('Delete Trip', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteTrip(id!); router.back(); } },
    ]);
  }

  if (!trip) {
    return <View style={styles.container}><Text style={styles.loading}>Loading...</Text></View>;
  }

  const currency = CURRENCIES[trip.currency] || { symbol: '₹', code: 'INR' };
  const totalExpenses = trip.expenses.reduce((sum, e) => sum + e.amount, 0);
  const settlements = simplifyDebts(trip.members, trip.expenses);
  const poolDeps = (trip as any).poolDeposits || [];
  const poolTelemetry = computePoolTelemetry(poolDeps, trip.expenses);

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 24) }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>{'<<'}</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.tripName}>#{trip.name.toLowerCase().replace(/\s+/g, '-')}</Text>
            <Text style={styles.tripMeta}>
              {currency.symbol}{totalExpenses.toLocaleString('en-IN')} total · {trip.currency}
            </Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.push(`/trips/invite?id=${trip.id}`)}>
            <Ionicons name="person-add-outline" size={18} color="#FFB000" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setShowSyncModal(true)}>
            <Ionicons name="sync-outline" size={18} color="#FFB000" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.push(`/trips/share-qr/${trip.id}`)}>
            <Ionicons name="qr-code-outline" size={18} color="#00FF66" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.headerBtn, { borderColor: '#FF3333' }]} onPress={handleDeleteTrip}>
            <Ionicons name="trash-outline" size={18} color="#FF3333" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Kitty Pool */}
        {poolTelemetry.totalDeposited > 0 && (
          <View style={styles.poolSection}>
            <View style={styles.poolHeader}>
              <Text style={styles.poolLabel}>KITTY POOL</Text>
              <Text style={styles.poolAmount}>
                {currency.symbol}{poolTelemetry.remainingBalance.toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={styles.poolBarBg}>
              <View style={[styles.poolBarFill, {
                width: `${Math.min(100, (1 - poolTelemetry.remainingBalance / poolTelemetry.totalDeposited) * 100)}%`,
              }]} />
            </View>
            <Text style={styles.poolMeta}>
              DEPOSITED: {currency.symbol}{poolTelemetry.totalDeposited.toLocaleString('en-IN')} · SPENT: {currency.symbol}{poolTelemetry.totalSpentFromPool.toLocaleString('en-IN')}
            </Text>
          </View>
        )}

        {/* Pool Deposit */}
        {showPoolDeposit ? (
          <View style={styles.poolDepositForm}>
            <Text style={styles.poolDepositLabel}>DEPOSIT AMOUNT</Text>
            <View style={styles.poolDepositRow}>
              <TextInput
                style={styles.poolDepositInput}
                placeholder={`${currency.symbol}0`}
                placeholderTextColor="#555555"
                value={poolAmount}
                onChangeText={setPoolAmount}
                keyboardType="numeric"
                autoFocus
              />
              <TouchableOpacity style={styles.poolDepositBtn} onPress={handlePoolDeposit}>
                <Text style={styles.poolDepositBtnText}>ADD</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.poolCancelBtn} onPress={() => { setShowPoolDeposit(false); setPoolAmount(''); }}>
                <Text style={styles.poolCancelBtnText}>X</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.poolDepositBtnMain} onPress={() => setShowPoolDeposit(true)}>
            <Ionicons name="add-circle-outline" size={16} color="#FFB000" />
            <Text style={styles.poolDepositBtnMainText}>ADD POOL DEPOSIT</Text>
          </TouchableOpacity>
        )}

        {/* P2P Auto-Sync Panel */}
        <View style={styles.syncPanel}>
          <View style={styles.syncPanelHeader}>
            <Ionicons name="cloud-done-outline" size={14} color="#00FF66" />
            <Text style={styles.syncPanelTitle}>MESH AUTO-SYNC · 30s</Text>
            <Text style={styles.syncPanelStatus}>
              {autoSync.isSyncing ? '⟳' : autoSync.healthy ? '●' : '!'}
            </Text>
          </View>
          <Text style={styles.syncPanelMsg}>
            {autoSync.lastMessage || 'Ready'}
          </Text>
          {ownIP && (
            <Text style={styles.myIP}>MY IP: {ownIP}:8765 · share this with a buddy</Text>
          )}
          {showPeerInput ? (
            <View style={styles.peerRow}>
              <TextInput
                style={styles.input}
                placeholder="buddy IP e.g. 192.168.1.50"
                placeholderTextColor="#555555"
                value={peerIP}
                onChangeText={setPeerIP}
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.addBtn} onPress={handleAddPeer}>
                <Text style={styles.addBtnText}>ADD</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.peerCancelBtn} onPress={() => { setShowPeerInput(false); setPeerIP(''); }}>
                <Text style={styles.peerCancelBtnText}>X</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.addPeerBtn} onPress={() => setShowPeerInput(true)}>
              <Ionicons name="wifi-outline" size={14} color="#00FF66" />
              <Text style={styles.addPeerBtnText}>+ ADD BUDDY'S IP FOR AUTO-SYNC</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Members */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>MEMBERS ({trip.members.length})</Text>
            <TouchableOpacity onPress={() => setShowMemberInput(!showMemberInput)}>
              <Ionicons name="person-add-outline" size={20} color="#00FF66" />
            </TouchableOpacity>
          </View>

          {showMemberInput && (
            <View style={styles.memberInput}>
              <TextInput
                style={styles.input}
                value={newMemberName}
                onChangeText={setNewMemberName}
                placeholder="Name or call-sign"
                placeholderTextColor="#555555"
                autoFocus
              />
              <TouchableOpacity style={styles.addBtn} onPress={handleAddMember}>
                <Text style={styles.addBtnText}>ADD</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.memberList}>
            {trip.members.map((m, i) => (
              <View key={m.id} style={styles.memberChip}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>{m.name[0].toUpperCase()}</Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{m.name}{i === 0 ? ' (Host)' : ''}</Text>
                  {m.upiOrHandle && <Text style={styles.memberUPI}>{m.upiOrHandle}</Text>}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Expenses */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>EXPENSES ({trip.expenses.length})</Text>
          {trip.members.length >= 2 && (
            <TouchableOpacity
              style={styles.addExpenseBtn}
              onPress={() => router.push(`/trips/expense/${trip.id}`)}
            >
              <Ionicons name="add" size={16} color="#000000" />
              <Text style={styles.addExpenseBtnText}>ADD</Text>
            </TouchableOpacity>
          )}
        </View>

        {trip.expenses.length === 0 ? (
          <EmptyState
            icon="receipt-outline"
            title="No expenses yet"
            subtitle='Say "Petrol 1500 split with all" or tap ADD'
          />
        ) : (
          trip.expenses.slice().reverse().map((item) => (
            <View key={item.id}>
              <ExpenseRow
                expense={item}
                members={trip.members}
                currency={trip.currency}
                onDelete={() => handleDeleteExpense(item.id)}
              />
            </View>
          ))
        )}

        {/* Settlements */}
        {settlements.length > 0 && (
          <TouchableOpacity
            style={styles.settleBtn}
            onPress={() => router.push(`/settle/${trip.id}`)}
          >
            <Ionicons name="cash-outline" size={18} color="#000000" />
            <Text style={styles.settleBtnText}>SETTLE UP ({settlements.length} payments)</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* P2P Sync Modal */}
      {trip && (
        <P2PSyncModal
          visible={showSyncModal}
          trip={trip}
          onClose={() => setShowSyncModal(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  loading: { color: '#555555', textAlign: 'center', marginTop: 64, fontFamily: 'monospace' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#222222',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtn: { padding: 4 },
  backText: { fontFamily: 'monospace', fontSize: 12, color: '#00FF66', letterSpacing: 1 },
  tripName: { fontFamily: 'monospace', fontSize: 16, color: '#E0E0E0', fontWeight: '700' },
  tripMeta: { fontFamily: 'monospace', fontSize: 10, color: '#555555', marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 6 },
  headerBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#1F1F1F',
    borderWidth: 1, borderColor: '#333333', justifyContent: 'center', alignItems: 'center',
  },
  scrollContent: { paddingBottom: 20 },
  poolSection: {
    margin: 16, backgroundColor: '#0A0A0A', borderRadius: 4, padding: 12,
    borderWidth: 1, borderColor: '#222222',
  },
  poolHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  poolLabel: { fontFamily: 'monospace', fontSize: 11, color: '#FFB000', fontWeight: '700', letterSpacing: 1 },
  poolAmount: { fontFamily: 'monospace', fontSize: 14, color: '#00FF66', fontWeight: '700' },
  poolBarBg: { height: 6, backgroundColor: '#1F1F1F', borderRadius: 3, overflow: 'hidden' },
  poolBarFill: { height: 6, backgroundColor: '#00FF66', borderRadius: 3 },
  poolMeta: { fontFamily: 'monospace', fontSize: 9, color: '#555555', marginTop: 6 },
  poolDepositBtnMain: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 16,
    backgroundColor: '#1F1F1F', borderRadius: 4, paddingVertical: 10, paddingHorizontal: 12,
    borderWidth: 1, borderColor: '#333333',
  },
  poolDepositBtnMainText: { fontFamily: 'monospace', fontSize: 11, color: '#FFB000', fontWeight: '700' },
  poolDepositForm: {
    margin: 16, backgroundColor: '#0A0A0A', borderRadius: 4, padding: 12,
    borderWidth: 1, borderColor: '#FFB000',
  },
  poolDepositLabel: { fontFamily: 'monospace', fontSize: 10, color: '#FFB000', letterSpacing: 1, marginBottom: 6 },
  poolDepositRow: { flexDirection: 'row', gap: 6 },
  poolDepositInput: {
    flex: 1, fontFamily: 'monospace', fontSize: 14, color: '#E0E0E0',
    backgroundColor: '#1F1F1F', borderRadius: 4, borderWidth: 1, borderColor: '#333333', padding: 8,
  },
  poolDepositBtn: { backgroundColor: '#FFB000', borderRadius: 4, paddingHorizontal: 12, justifyContent: 'center' },
  poolDepositBtnText: { fontFamily: 'monospace', fontSize: 11, color: '#000000', fontWeight: '700' },
  poolCancelBtn: { backgroundColor: '#333333', borderRadius: 4, paddingHorizontal: 10, justifyContent: 'center' },
  poolCancelBtnText: { fontFamily: 'monospace', fontSize: 11, color: '#888888', fontWeight: '700' },
  syncPanel: {
    margin: 16, backgroundColor: '#0A0A0A', borderRadius: 4, padding: 12,
    borderWidth: 1, borderColor: '#00FF66',
  },
  syncPanelHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  syncPanelTitle: { fontFamily: 'monospace', fontSize: 11, color: '#00FF66', fontWeight: '700', letterSpacing: 1 },
  syncPanelStatus: { marginLeft: 'auto', fontFamily: 'monospace', fontSize: 12, color: '#00FF66' },
  syncPanelMsg: { fontFamily: 'monospace', fontSize: 11, color: '#888888', marginBottom: 4 },
  myIP: { fontFamily: 'monospace', fontSize: 10, color: '#FFB000', marginBottom: 8 },
  addPeerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1F1F1F', borderRadius: 4, paddingVertical: 8, paddingHorizontal: 10,
  },
  addPeerBtnText: { fontFamily: 'monospace', fontSize: 11, color: '#00FF66', fontWeight: '700' },
  peerRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  peerCancelBtn: { backgroundColor: '#333333', borderRadius: 4, paddingHorizontal: 10, justifyContent: 'center' },
  peerCancelBtnText: { fontFamily: 'monospace', fontSize: 11, color: '#888888', fontWeight: '700' },
  section: { paddingHorizontal: 16, marginBottom: 8 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  sectionTitle: { fontFamily: 'monospace', fontSize: 11, color: '#888888', letterSpacing: 1, fontWeight: '700' },
  memberInput: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  input: {
    flex: 1, fontFamily: 'monospace', fontSize: 13, color: '#E0E0E0',
    backgroundColor: '#1F1F1F', borderRadius: 4, borderWidth: 1, borderColor: '#333333', padding: 8,
  },
  addBtn: { backgroundColor: '#00FF66', borderRadius: 4, paddingHorizontal: 12, justifyContent: 'center' },
  addBtnText: { fontFamily: 'monospace', fontSize: 11, color: '#000000', fontWeight: '700' },
  memberList: { gap: 6 },
  memberChip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#0A0A0A', borderRadius: 4, padding: 10,
    borderWidth: 1, borderColor: '#222222',
  },
  memberAvatar: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#1F1F1F',
    borderWidth: 1, borderColor: '#333333', justifyContent: 'center', alignItems: 'center',
  },
  memberAvatarText: { fontFamily: 'monospace', fontSize: 13, color: '#00FF66', fontWeight: '700' },
  memberInfo: { flex: 1 },
  memberName: { fontFamily: 'monospace', fontSize: 13, color: '#E0E0E0', fontWeight: '600' },
  memberUPI: { fontFamily: 'monospace', fontSize: 10, color: '#555555', marginTop: 2 },
  addExpenseBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#00FF66', borderRadius: 4, paddingHorizontal: 10, paddingVertical: 5,
  },
  addExpenseBtnText: { fontFamily: 'monospace', fontSize: 11, color: '#000000', fontWeight: '700' },
  settleBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    margin: 16, backgroundColor: '#FFB000', borderRadius: 6, paddingVertical: 14,
  },
  settleBtnText: { fontFamily: 'monospace', fontSize: 13, color: '#000000', fontWeight: '700', letterSpacing: 1 },
});
