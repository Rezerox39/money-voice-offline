import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { ensureGroupCode, getTripById } from '../../src/lib/database';
import { getDeviceLANIP } from '../../src/lib/lanSync';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../src/constants';

const QR_PREFIX = 'MV_JOIN:';

export default function InviteTripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [groupCode, setGroupCode] = useState<string | null>(null);
  const [tripName, setTripName] = useState('');
  const [hostIP, setHostIP] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadCode();
      getDeviceLANIP().then((ip) => {
        if (ip) setHostIP(ip);
      });
    }
  }, [id]);

  async function loadCode() {
    const trip = await getTripById(id!);
    if (!trip) return;
    setTripName(trip.name);
    const code = await ensureGroupCode(id!);
    setGroupCode(code);
  }

  function handleCopyCode() {
    if (!groupCode) return;
    Clipboard.setStringAsync(groupCode);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copied', `Group code "${groupCode}" copied to clipboard.`);
  }

  if (!groupCode) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Generating invite code...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 24), paddingBottom: Math.max(insets.bottom, 32) }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>{'<< BACK'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>INVITE TO GROUP</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.body}>
        {/* Trip name */}
        <Text style={styles.tripName}>#{tripName.toLowerCase().replace(/\s+/g, '-')}</Text>

        {/* Group Code */}
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>GROUP CODE</Text>
          <Text style={styles.codeValue}>{groupCode}</Text>
          <TouchableOpacity style={styles.copyBtn} onPress={handleCopyCode}>
            <Ionicons name="copy-outline" size={14} color="#00FF66" />
            <Text style={styles.copyBtnText}>COPY CODE</Text>
          </TouchableOpacity>
        </View>

        {/* QR Code */}
        <View style={styles.qrCard}>
          <Text style={styles.qrLabel}>OR SCAN THIS QR</Text>
          <View style={styles.qrWrapper}>
            <QRCode
              value={`${QR_PREFIX}${groupCode}`}
              size={220}
              backgroundColor="#FFFFFF"
              color="#000000"
            />
          </View>
          <Text style={styles.qrHint}>Your friend scans this in [JOIN GROUP]</Text>
        </View>

        {/* Instructions */}
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionHeader}>HOW IT WORKS</Text>
          <View style={styles.instructionRow}>
            <Text style={styles.instructionNum}>1</Text>
            <Text style={styles.instructionText}>Share the 6-digit code OR show this QR</Text>
          </View>
          <View style={styles.instructionRow}>
            <Text style={styles.instructionNum}>2</Text>
            <Text style={styles.instructionText}>Friend opens [JOIN GROUP] in their app</Text>
          </View>
          <View style={styles.instructionRow}>
            <Text style={styles.instructionNum}>3</Text>
            <Text style={styles.instructionText}>They enter the code or scan this QR</Text>
          </View>
          <View style={styles.instructionRow}>
            <Text style={styles.instructionNum}>4</Text>
            <Text style={styles.instructionText}>Both devices are synced automatically</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  loading: { color: '#555555', textAlign: 'center', marginTop: 80, fontFamily: 'monospace' },
  content: { alignItems: 'center', paddingBottom: 40 },
  header: {
    width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#222222',
  },
  backBtn: { padding: 4, width: 60 },
  backText: { fontFamily: 'monospace', fontSize: 12, color: '#00FF66', letterSpacing: 1 },
  headerTitle: { fontFamily: 'monospace', fontSize: 14, color: '#FFB000', fontWeight: '700', letterSpacing: 2 },
  body: { width: '100%', alignItems: 'center', gap: 20, paddingHorizontal: 24 },
  tripName: { fontFamily: 'monospace', fontSize: 18, color: '#00FF66', fontWeight: '700', letterSpacing: 1 },
  codeCard: {
    width: '100%', backgroundColor: '#0A0A0A', borderRadius: RADIUS.sm, padding: 20,
    borderWidth: 1, borderColor: '#FFB000', alignItems: 'center', gap: 8,
  },
  codeLabel: { fontFamily: 'monospace', fontSize: 10, color: '#FFB000', letterSpacing: 1, fontWeight: '700' },
  codeValue: {
    fontFamily: 'monospace', fontSize: 36, color: '#00FF66', fontWeight: '700',
    letterSpacing: 8, paddingVertical: 8,
  },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1F1F1F', borderRadius: 4, paddingVertical: 8, paddingHorizontal: 16,
  },
  copyBtnText: { fontFamily: 'monospace', fontSize: 11, color: '#00FF66', fontWeight: '700' },
  qrCard: {
    width: '100%', backgroundColor: '#0A0A0A', borderRadius: RADIUS.sm, padding: 24,
    borderWidth: 1, borderColor: '#222222', alignItems: 'center', gap: 12,
  },
  qrLabel: { fontFamily: 'monospace', fontSize: 10, color: '#888888', letterSpacing: 1 },
  qrWrapper: { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 16 },
  qrHint: { fontFamily: 'monospace', fontSize: 10, color: '#555555', textAlign: 'center' },
  ipCard: {
    width: '100%', backgroundColor: '#0A0A0A', borderRadius: RADIUS.sm, padding: 16,
    borderWidth: 1, borderColor: '#00FF66', alignItems: 'center', gap: 6,
  },
  ipLabel: { fontFamily: 'monospace', fontSize: 10, color: '#00FF66', letterSpacing: 1, fontWeight: '700' },
  ipValue: { fontFamily: 'monospace', fontSize: 16, color: '#FFFFFF', fontWeight: '700', letterSpacing: 1 },
  ipHint: { fontFamily: 'monospace', fontSize: 10, color: '#555555', textAlign: 'center' },
  instructionsCard: {
    width: '100%', backgroundColor: '#0A0A0A', borderRadius: RADIUS.sm, padding: 16,
    borderWidth: 1, borderColor: '#222222', gap: 12,
  },
  instructionHeader: { fontFamily: 'monospace', fontSize: 10, color: '#555555', letterSpacing: 1, fontWeight: '700' },
  instructionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  instructionNum: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: '#1F1F1F',
    borderWidth: 1, borderColor: '#333333', textAlign: 'center', textAlignVertical: 'center',
    fontFamily: 'monospace', fontSize: 11, color: '#FFB000', fontWeight: '700',
  },
  instructionText: { fontFamily: 'monospace', fontSize: 11, color: '#888888', flex: 1 },
});
