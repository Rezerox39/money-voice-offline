// ─────────────────────────────────────────────────────────────────
// settings.tsx — Terminal Settings & Panic Wipe
// BitChat emergency reset: drops all local data, reinitializes.
// ─────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { resetDatabase } from '../src/lib/database';

export default function SettingsScreen() {
  const router = useRouter();
  const [isWiping, setIsWiping] = useState(false);
  const [step, setStep] = useState<'idle' | 'confirm1' | 'confirm2'>('idle');

  function handlePanicWipe() {
    if (step === 'idle') {
      setStep('confirm1');
      return;
    }
    if (step === 'confirm1') {
      setStep('confirm2');
      return;
    }
    // Double-confirmed — execute wipe
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

  function cancelWipe() {
    setStep('idle');
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>{'<< BACK'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SETTINGS</Text>
        <View style={{ width: 48 }} />
      </View>

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
              <TouchableOpacity style={styles.cancelBtn} onPress={cancelWipe}>
                <Text style={styles.cancelBtnText}>ABORT</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.warnBtn} onPress={handlePanicWipe}>
                <Text style={styles.warnBtnText}>I UNDERSTAND — CONTINUE</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {step === 'confirm2' && (
          <View style={styles.confirmBox}>
            <Text style={[styles.confirmText, { color: '#FF3333' }]}>
              FINAL WARNING: This action is irreversible. All data will be destroyed.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={cancelWipe}>
                <Text style={styles.cancelBtnText}>ABORT</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dangerBtn, { opacity: isWiping ? 0.5 : 1 }]}
                onPress={handlePanicWipe}
                disabled={isWiping}
              >
                <Text style={styles.dangerBtnText}>
                  {isWiping ? 'WIPE IN PROGRESS...' : '🗑 DESTROY ALL DATA'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? 32 : 16,
    paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#222222',
  },
  backBtn: { padding: 8 },
  backText: { fontFamily: 'monospace', fontSize: 12, color: '#00FF66', letterSpacing: 1 },
  headerTitle: { fontFamily: 'monospace', fontSize: 16, color: '#00FF66', fontWeight: '700', letterSpacing: 2 },
  section: {
    margin: 16, backgroundColor: '#0A0A0A', borderRadius: 4,
    padding: 16, borderWidth: 1, borderColor: '#222222',
  },
  sectionLabel: {
    fontFamily: 'monospace', fontSize: 11, color: '#FFB000', letterSpacing: 1,
    fontWeight: '700', marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#1A1A1A',
  },
  infoKey: { fontFamily: 'monospace', fontSize: 11, color: '#888888' },
  infoVal: { fontFamily: 'monospace', fontSize: 11, color: '#00FF66', fontWeight: '600' },
  dangerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#1A0000', borderRadius: 4, padding: 12,
    borderWidth: 1, borderColor: '#FF3333',
  },
  dangerBtnText: { fontFamily: 'monospace', fontSize: 12, color: '#FF3333', fontWeight: '700' },
  confirmBox: { gap: 12 },
  confirmText: { fontFamily: 'monospace', fontSize: 12, color: '#FFB000', lineHeight: 18 },
  confirmActions: { flexDirection: 'row', gap: 8 },
  cancelBtn: {
    flex: 1, backgroundColor: '#1F1F1F', borderRadius: 4, padding: 12,
    borderWidth: 1, borderColor: '#333333', alignItems: 'center',
  },
  cancelBtnText: { fontFamily: 'monospace', fontSize: 11, color: '#888888', fontWeight: '700' },
  warnBtn: {
    flex: 1, backgroundColor: '#1A1A00', borderRadius: 4, padding: 12,
    borderWidth: 1, borderColor: '#FFB000', alignItems: 'center',
  },
  warnBtnText: { fontFamily: 'monospace', fontSize: 11, color: '#FFB000', fontWeight: '700' },
});
