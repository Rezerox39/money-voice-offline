import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { resetDatabase } from '../src/lib/database';
import { getProfile } from '../src/lib/profile';
import { getStreakData } from '../src/lib/streak';
import { useLedger } from '../src/context/LedgerContext';
import { ParticleField } from '../src/components/ParticleField';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeTrip, mode } = useLedger();
  const [isWiping, setIsWiping] = useState(false);
  const [step, setStep] = useState<'idle' | 'confirm1' | 'confirm2'>('idle');
  const [userName, setUserName] = useState('You');
  const [userCurrency, setUserCurrency] = useState('INR');
  const [streak, setStreak] = useState(0);

  const load = useCallback(async () => {
    try {
      const p = await getProfile();
      setUserName(p.name || 'You');
      setUserCurrency(p.defaultCurrency || 'INR');
      const s = await getStreakData();
      setStreak(s?.currentStreak || 0);
    } catch {
      // defaults
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handlePanicWipe() {
    if (step === 'idle') { setStep('confirm1'); return; }
    if (step === 'confirm1') { setStep('confirm2'); return; }
    executeWipe();
  }

  async function executeWipe() {
    setIsWiping(true);
    try {
      await resetDatabase();
      Alert.alert(
        'Node Reset Complete',
        'All local data wiped. Fresh workspace initialized.',
        [{ text: 'OK', onPress: () => { setStep('idle'); router.replace('/'); } }]
      );
    } catch (err: any) {
      Alert.alert('Wipe Failed', err?.message ?? 'Unknown error');
      setStep('idle');
    } finally {
      setIsWiping(false);
    }
  }

  function cancelWipe() { setStep('idle'); }

  const activeTripName = activeTrip?.name
    ? `#${activeTrip.name.toLowerCase().replace(/\s+/g, '-')}`
    : 'NO TRIP ACTIVE';

  return (
    <View style={styles.container}>
      <ParticleField active={true} count={14} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: Math.max(insets.top, 24) }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>{'<< BACK'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>[⚙ SYS]</Text>
        <View style={{ width: 48 }} />
      </View>

      {/* ── USER PROFILE CARD ── */}
      <TouchableOpacity style={styles.card} onPress={() => { Haptics.selectionAsync(); router.push('/profile'); }}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardLabel}>NODE / PROFILE</Text>
          <Ionicons name="chevron-forward" size={16} color="#555555" />
        </View>
        <View style={styles.profileRow}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{userName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{userName}</Text>
            <Text style={styles.profileMeta}>{userCurrency} · {streak > 0 ? `${streak}🔥 streak` : 'No streak'}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* ── TRIP & MESH CARD ── */}
      <TouchableOpacity style={styles.card} onPress={() => { Haptics.selectionAsync(); router.push('/trips'); }}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardLabel}>TRIP & MESH</Text>
          <Ionicons name="chevron-forward" size={16} color="#555555" />
        </View>
        <View style={styles.tripRow}>
          <View style={styles.meshDot} />
          <View style={styles.tripInfo}>
            <Text style={styles.tripName}>{activeTripName}</Text>
            <Text style={styles.tripMeta}>
              MODE: {mode} · OFFLINE MESH · P2P QR READY
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* System Info */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>SYSTEM</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoKey}>VERSION</Text>
          <Text style={styles.infoVal}>1.0.0-offline</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoKey}>MODE</Text>
          <Text style={styles.infoVal}>LOCAL ONLY</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoKey}>CLOUD</Text>
          <Text style={[styles.infoVal, { color: '#FF3333' }]}>DISABLED</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoKey}>SERVERS</Text>
          <Text style={[styles.infoVal, { color: '#FF3333' }]}>NONE</Text>
        </View>
      </View>

      {/* Privacy */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>PRIVACY</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoKey}>DATA LOCATION</Text>
          <Text style={styles.infoVal}>ON-DEVICE ONLY</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoKey}>ANALYTICS</Text>
          <Text style={[styles.infoVal, { color: '#FF3333' }]}>NONE</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoKey}>TRACKING</Text>
          <Text style={[styles.infoVal, { color: '#FF3333' }]}>NONE</Text>
        </View>
      </View>

      {/* Panic Wipe */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>EMERGENCY</Text>
        {step === 'idle' && (
          <TouchableOpacity style={styles.dangerBtn} onPress={handlePanicWipe}>
            <Ionicons name="skull-outline" size={18} color="#FF3333" />
            <Text style={styles.dangerBtnText}>⚠ PANIC WIPE / RESET NODE</Text>
          </TouchableOpacity>
        )}
        {step === 'confirm1' && (
          <View style={styles.confirmBox}>
            <Text style={styles.confirmText}>
              This will permanently delete ALL trip data, expenses, and pool records.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={cancelWipe}><Text style={styles.cancelBtnText}>ABORT</Text></TouchableOpacity>
              <TouchableOpacity style={styles.warnBtn} onPress={handlePanicWipe}><Text style={styles.warnBtnText}>I UNDERSTAND — CONTINUE</Text></TouchableOpacity>
            </View>
          </View>
        )}
        {step === 'confirm2' && (
          <View style={styles.confirmBox}>
            <Text style={[styles.confirmText, { color: '#FF3333' }]}>FINAL WARNING: This action is irreversible. All data will be destroyed.</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={cancelWipe}><Text style={styles.cancelBtnText}>ABORT</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.dangerBtn, { opacity: isWiping ? 0.5 : 1 }]} onPress={handlePanicWipe} disabled={isWiping}>
                <Text style={styles.dangerBtnText}>{isWiping ? 'WIPE IN PROGRESS...' : '🗑 DESTROY ALL DATA'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000', paddingBottom: 32 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#222222',
  },
  backBtn: { padding: 8 },
  backText: { fontFamily: 'monospace', fontSize: 12, color: '#00FF66', letterSpacing: 1 },
  headerTitle: { fontFamily: 'monospace', fontSize: 16, color: '#00FF66', fontWeight: '700', letterSpacing: 2 },
  card: {
    margin: 16, backgroundColor: '#0A0A0A', borderRadius: 4, padding: 16,
    borderWidth: 1, borderColor: '#222222', marginBottom: 0,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardLabel: { fontFamily: 'monospace', fontSize: 11, color: '#FFB000', letterSpacing: 1, fontWeight: '700' },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarCircle: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#1F1F1F',
    borderWidth: 1, borderColor: '#00FF66', justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontFamily: 'monospace', fontSize: 16, color: '#00FF66', fontWeight: '700' },
  profileInfo: { flex: 1 },
  profileName: { fontFamily: 'monospace', fontSize: 14, color: '#E0E0E0', fontWeight: '700' },
  profileMeta: { fontFamily: 'monospace', fontSize: 10, color: '#555555', marginTop: 2 },
  tripRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  meshDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#00FF66' },
  tripInfo: { flex: 1 },
  tripName: { fontFamily: 'monospace', fontSize: 14, color: '#E0E0E0', fontWeight: '700' },
  tripMeta: { fontFamily: 'monospace', fontSize: 9, color: '#555555', marginTop: 2 },
  section: {
    margin: 16, marginBottom: 0, backgroundColor: '#0A0A0A', borderRadius: 4,
    padding: 16, borderWidth: 1, borderColor: '#222222',
  },
  sectionLabel: { fontFamily: 'monospace', fontSize: 11, color: '#FFB000', letterSpacing: 1, fontWeight: '700', marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#1A1A1A' },
  infoKey: { fontFamily: 'monospace', fontSize: 11, color: '#888888' },
  infoVal: { fontFamily: 'monospace', fontSize: 11, color: '#00FF66', fontWeight: '600' },
  dangerBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1A0000', borderRadius: 4, padding: 12, borderWidth: 1, borderColor: '#FF3333' },
  dangerBtnText: { fontFamily: 'monospace', fontSize: 12, color: '#FF3333', fontWeight: '700' },
  confirmBox: { gap: 12 },
  confirmText: { fontFamily: 'monospace', fontSize: 12, color: '#FFB000', lineHeight: 18 },
  confirmActions: { flexDirection: 'row', gap: 8 },
  cancelBtn: { flex: 1, backgroundColor: '#1F1F1F', borderRadius: 4, padding: 12, borderWidth: 1, borderColor: '#333333', alignItems: 'center' },
  cancelBtnText: { fontFamily: 'monospace', fontSize: 11, color: '#888888', fontWeight: '700' },
  warnBtn: { flex: 1, backgroundColor: '#1A1A00', borderRadius: 4, padding: 12, borderWidth: 1, borderColor: '#FFB000', alignItems: 'center' },
  warnBtnText: { fontFamily: 'monospace', fontSize: 11, color: '#FFB000', fontWeight: '700' },
});
