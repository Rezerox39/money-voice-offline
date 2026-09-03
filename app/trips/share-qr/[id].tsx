import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Share,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { getTripById } from '../../../src/lib/database';
import { encodeTripForQR, exportTripAsFile } from '../../../src/lib/qr-sync';
import { Trip } from '../../../src/types';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../../src/constants';

export default function ShareQRScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [isOversized, setIsOversized] = useState(false);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    loadTrip();
  }, [id]);

  async function loadTrip() {
    if (!id) return;
    const t = await getTripById(id);
    if (!t) return;
    setTrip(t);

    try {
      const data = encodeTripForQR(t);
      setQrPayload(data);
      setIsOversized(new Blob([data]).size > 1500);
      setErrored(false);
    } catch (e: any) {
      if (e.message === 'PAYLOAD_TOO_LARGE') {
        setIsOversized(true);
      } else {
        setErrored(true);
      }
    }
  }

  async function handleExportJSON() {
    if (!trip) return;
    await exportTripAsFile(trip);
  }

  async function handleCopyRaw() {
    if (qrPayload) {
      await Share.share({
        message: qrPayload,
        title: `Money Voice Trip: ${trip?.name ?? 'Trip'}`,
      });
    }
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
      <Text style={styles.title}>Scan to Sync</Text>
      <Text style={styles.subtitle}>
        Have your friend tap the QR icon in Money Voice and scan this
      </Text>

      {!isOversized && qrPayload ? (
        <View style={styles.qrContainer}>
          <QRCode
            value={qrPayload}
            size={260}
            backgroundColor="#FFFFFF"
            color="#000000"
            quietZone={10}
          />
        </View>
      ) : (
        <View style={styles.warningBox}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.accent} />
          <Text style={styles.warningText}>
            {errored
              ? 'Could not generate QR data.'
              : `"${trip.name}" has too much data for a camera QR scan.`}
          </Text>
          <TouchableOpacity style={styles.exportBtn} onPress={handleExportJSON}>
            <Ionicons name="document-outline" size={18} color={COLORS.white} />
            <Text style={styles.exportBtnText}>Export as File via Share Sheet</Text>
          </TouchableOpacity>
        </View>
      )}

      {qrPayload && !isOversized && (
        <TouchableOpacity style={styles.copyBtn} onPress={handleCopyRaw}>
          <Ionicons name="copy-outline" size={18} color={COLORS.primary} />
          <Text style={styles.copyBtnText}>Copy Raw Payload</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  loading: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xxxl,
  },
  content: {
    alignItems: 'center',
    padding: SPACING.xl,
    gap: SPACING.lg,
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.lg,
  },
  subtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  qrContainer: {
    padding: SPACING.lg,
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
  },
  warningBox: {
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.xxl,
    paddingHorizontal: SPACING.xl,
  },
  warningText: {
    color: COLORS.accent,
    fontSize: FONT_SIZE.md,
    textAlign: 'center',
    lineHeight: 20,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.md,
  },
  exportBtnText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: SPACING.lg,
  },
  copyBtnText: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.md,
    fontWeight: '500',
  },
});
