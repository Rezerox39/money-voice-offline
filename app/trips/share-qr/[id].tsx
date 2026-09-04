// ─────────────────────────────────────────────────────────────────
// [id].tsx — AMOLED QR Share Screen with AnimatedQR
// Displays animated multi-frame QR for large payloads,
// static QR for small payloads, and JSON export fallback.
// ─────────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getTripById } from '../../../src/lib/database';
import { exportTripAsFile } from '../../../src/lib/qr-sync';
import { encodeTripMesh } from '../../../src/lib/qrMesh';
import { AnimatedQR } from '../../../src/components/AnimatedQR';
import { Trip } from '../../../src/types';
import { SPACING } from '../../../src/constants';

export default function ShareQRScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [isOversized, setIsOversized] = useState(false);
  const [meshInfo, setMeshInfo] = useState<{ frames: number; bytes: number } | null>(null);

  useEffect(() => {
    loadTrip();
  }, [id]);

  async function loadTrip() {
    if (!id) return;
    const t = await getTripById(id);
    if (!t) return;
    setTrip(t);

    const json = JSON.stringify(t);
    const mesh = encodeTripMesh(json);
    setMeshInfo({ frames: mesh.frames.length, bytes: mesh.totalPayloadBytes });
    setIsOversized(mesh.frames.length > 1);
  }

  async function handleExportJSON() {
    if (!trip) return;
    await exportTripAsFile(trip);
  }

  if (!trip) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>{'<< BACK'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>SYNC QR</Text>
      <Text style={styles.subtitle}>
        Have your friend tap [QR] in their Money Voice app
      </Text>

      {/* QR Display */}
      <AnimatedQR data={JSON.stringify(trip)} />

      {/* Mesh Info */}
      {meshInfo && (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            {meshInfo.frames} frame{meshInfo.frames > 1 ? 's' : ''} · {meshInfo.bytes.toLocaleString()} bytes
          </Text>
        </View>
      )}

      {/* Export Fallback */}
      <TouchableOpacity style={styles.exportBtn} onPress={handleExportJSON}>
        <Ionicons name="document-outline" size={18} color="#00FF66" />
        <Text style={styles.exportBtnText}>EXPORT AS FILE</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  loading: { color: '#555555', textAlign: 'center', marginTop: SPACING.xxxl, fontFamily: 'monospace' },
  content: { alignItems: 'center', padding: SPACING.xl, gap: SPACING.lg },
  header: {
    width: '100%', paddingTop: Platform.OS === 'android' ? SPACING.xxxl : SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  backBtn: { padding: 4 },
  backText: { fontFamily: 'monospace', fontSize: 12, color: '#00FF66', letterSpacing: 1 },
  title: { fontFamily: 'monospace', fontSize: 20, color: '#00FF66', fontWeight: '700', letterSpacing: 2 },
  subtitle: { fontFamily: 'monospace', fontSize: 12, color: '#555555', textAlign: 'center' },
  infoBox: {
    backgroundColor: '#0A0A0A', borderRadius: 4, paddingVertical: 6, paddingHorizontal: 12,
    borderWidth: 1, borderColor: '#222222',
  },
  infoText: { fontFamily: 'monospace', fontSize: 11, color: '#888888' },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: '#1F1F1F', borderRadius: 4, paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl, borderWidth: 1, borderColor: '#333333', marginTop: SPACING.lg,
  },
  exportBtnText: { fontFamily: 'monospace', fontSize: 13, color: '#00FF66', fontWeight: '700' },
});
