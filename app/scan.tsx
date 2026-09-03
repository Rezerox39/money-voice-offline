import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { decodeTripFromQR, importTripFromFile } from '../src/lib/qr-sync';
import { mergeTripFromPayload } from '../src/lib/database';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../src/constants';
import * as DocumentPicker from 'expo-document-picker';

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  if (!permission) {
    return <View style={styles.container}><Text style={styles.loading}>Loading...</Text></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.permContainer}>
          <Ionicons name="camera-outline" size={64} color={COLORS.textMuted} />
          <Text style={styles.permTitle}>Camera Permission Required</Text>
          <Text style={styles.permSubtitle}>
            We need camera access to scan QR codes for trip sync.
          </Text>
          <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
            <Text style={styles.permBtnText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.fallbackBtn} onPress={handleImportFile}>
            <Text style={styles.fallbackBtnText}>Or import JSON file</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function handleBarCodeScanned({ data }: { data: string }) {
    if (scanned) return;
    setScanned(true);

    const payload = decodeTripFromQR(data);
    if (!payload) {
      Alert.alert('Invalid QR', 'This QR code does not contain a valid Money Voice trip.', [
        { text: 'OK', onPress: () => setScanned(false) },
      ]);
      return;
    }

    mergeTripFromPayload(payload.trip).then((result) => {
      Alert.alert(
        'Trip Imported',
        `${payload.trip.name}: ${result.inserted} new expenses, ${result.membersAdded} new members.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    });
  }

  async function handleImportFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const payload = await importTripFromFile(result.assets[0].uri);
      if (!payload) {
        Alert.alert('Invalid File', 'This file does not contain a valid trip payload.');
        return;
      }

      const mergeResult = await mergeTripFromPayload(payload.trip);
      Alert.alert(
        'Trip Imported',
        `${payload.trip.name}: ${mergeResult.inserted} new expenses, ${mergeResult.membersAdded} new members.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch {
      Alert.alert('Import Failed', 'Could not read the selected file.');
    }
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      >
        <View style={styles.overlay}>
          <View style={styles.scanFrame} />
          <Text style={styles.instruction}>Point camera at QR code</Text>
        </View>
      </CameraView>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.fileBtn} onPress={handleImportFile}>
          <Ionicons name="document-outline" size={20} color={COLORS.primary} />
          <Text style={styles.fileBtnText}>Import JSON File</Text>
        </TouchableOpacity>
      </View>
    </View>
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
  permContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxxl,
    gap: SPACING.md,
  },
  permTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '600',
    color: COLORS.text,
  },
  permSubtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  permBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.lg,
    marginTop: SPACING.md,
  },
  permBtnText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
  },
  fallbackBtn: {
    marginTop: SPACING.sm,
  },
  fallbackBtnText: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.md,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.lg,
  },
  instruction: {
    color: COLORS.white,
    fontSize: FONT_SIZE.md,
    marginTop: SPACING.lg,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  bottomBar: {
    padding: SPACING.lg,
    backgroundColor: COLORS.bg,
  },
  fileBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  fileBtnText: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
  },
});
