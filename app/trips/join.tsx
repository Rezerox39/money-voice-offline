import React, { useState, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLedger } from '../../src/context/LedgerContext';
import { getTripByGroupCode, addMember } from '../../src/lib/database';
import { registerPeerByIP } from '../../src/lib/lanSync';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../src/constants';
import { generateUUID } from '../../src/lib/uuid';

const QR_PREFIX = 'MV:';

export default function JoinTripScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setActiveTripId, refreshTrips } = useLedger();
  const [groupCode, setGroupCode] = useState('');
  const [memberName, setMemberName] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [hostIP, setHostIP] = useState('');
  const [permission, requestPermission] = useCameraPermissions();

  const isProcessingRef = useRef(false);
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleJoin = useCallback(async (code: string) => {
    if (isJoining) return;
    const trimmed = code.trim().toUpperCase().replace(/\s+/g, '');
    if (!trimmed) return;
    if (!memberName.trim()) {
      Alert.alert('Name Required', 'Enter your call-sign before joining.');
      return;
    }

    setIsJoining(true);
    try {
      const trip = await getTripByGroupCode(trimmed);
      if (!trip) {
        Alert.alert('Trip Not Found', `No trip found with code "${trimmed}". Check the code and try again.`);
        setIsJoining(false);
        return;
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await addMember(trip.id, memberName.trim());
      if (hostIP.trim()) {
        await registerPeerByIP(hostIP.trim(), 'Host');
      }
      await refreshTrips();
      setActiveTripId(trip.id);
      router.replace(`/trips/${trip.id}`);
    } catch (err: any) {
      Alert.alert('Join Failed', err?.message || 'Could not join trip.');
      setIsJoining(false);
    }
  }, [isJoining, memberName, refreshTrips, setActiveTripId, router]);

  const handleQRScanned = useCallback(({ data }: { data: string }) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    let code = data;
    if (data.startsWith(QR_PREFIX)) {
      code = data.slice(QR_PREFIX.length);
    }
    if (data.startsWith('MV_JOIN:')) {
      code = data.slice('MV_JOIN:'.length);
    }

    if (/^[A-Z0-9]{6}$/.test(code)) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      Alert.alert('Join Trip', `Group code detected: ${code}. Join this trip?`, [
        { text: 'Cancel', style: 'cancel', onPress: () => { isProcessingRef.current = false; } },
        { text: 'Join', onPress: () => handleJoin(code) },
      ]);
    } else {
      Alert.alert('Invalid QR', 'This QR does not contain a valid Money Voice group code.');
    }

    cooldownRef.current = setTimeout(() => {
      isProcessingRef.current = false;
    }, 1500);
  }, [handleJoin]);

  async function handleOpenCamera() {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert('Camera Required', 'Camera access is needed to scan group QR codes.');
        return;
      }
    }
    setShowCamera(true);
  }

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 24), paddingBottom: Math.max(insets.bottom, 16) }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>{'<< BACK'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>JOIN GROUP</Text>
        <View style={{ width: 60 }} />
      </View>

      {!showCamera ? (
        <View style={styles.content}>
          {/* Group Code Entry */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>ENTER GROUP CODE</Text>
            <Text style={styles.hint}>Get a 6-digit code from the trip host</Text>
            <TextInput
              style={styles.codeInput}
              value={groupCode}
              onChangeText={(t) => setGroupCode(t.toUpperCase().replace(/\s+/g, '').slice(0, 6))}
              placeholder="XXXXXX"
              placeholderTextColor="#555555"
              autoCapitalize="characters"
              maxLength={6}
            />
          </View>

          {/* Member Name */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>YOUR CALL-SIGN</Text>
            <TextInput
              style={styles.nameInput}
              value={memberName}
              onChangeText={setMemberName}
              placeholder="What should the group call you?"
              placeholderTextColor="#555555"
              autoCapitalize="words"
              maxLength={30}
            />
          </View>

          {/* Host IP (optional, for auto-sync) */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>HOST IP (OPTIONAL)</Text>
            <Text style={styles.hint}>Enter host device IP for auto-sync over LAN</Text>
            <TextInput
              style={[styles.nameInput, { letterSpacing: 1, fontFamily: 'monospace' }]}
              value={hostIP}
              onChangeText={setHostIP}
              placeholder="e.g. 192.168.1.100"
              placeholderTextColor="#555555"
              autoCapitalize="none"
              keyboardType="decimal-pad"
            />
          </View>

          {/* Join Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[
                styles.joinBtn,
                (groupCode.length !== 6 || !memberName.trim()) && styles.joinBtnDisabled
              ]}
              disabled={groupCode.length !== 6 || !memberName.trim() || isJoining}
              onPress={() => handleJoin(groupCode)}
            >
              <Ionicons name="enter" size={16} color="#000000" />
              <Text style={styles.joinBtnText}>
                {isJoining ? 'JOINING...' : 'JOIN TRIP'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.scanBtn} onPress={handleOpenCamera}>
              <Ionicons name="scan-outline" size={16} color="#FFB000" />
              <Text style={styles.scanBtnText}>SCAN QR CODE</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleQRScanned}
          >
            <View style={styles.overlay}>
              <View style={styles.scanFrame} />
              <Text style={styles.instruction}>Point camera at trip QR code</Text>
              <TextInput
                style={[styles.nameInput, { position: 'absolute', bottom: 80, width: '80%', backgroundColor: 'rgba(0,0,0,0.85)', borderColor: '#FFB000' }]}
                value={memberName}
                onChangeText={setMemberName}
                placeholder="Your call-sign"
                placeholderTextColor="#FFB000"
                autoCapitalize="words"
              />
            </View>
          </CameraView>
          <TouchableOpacity style={styles.stopCameraBtn} onPress={() => setShowCamera(false)}>
            <Text style={styles.stopCameraBtnText}>TYPE CODE INSTEAD</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#222222',
  },
  backBtn: { padding: 4, width: 60 },
  backText: { fontFamily: 'monospace', fontSize: 12, color: '#00FF66', letterSpacing: 1 },
  headerTitle: { fontFamily: 'monospace', fontSize: 16, color: '#FFB000', fontWeight: '700', letterSpacing: 2 },
  content: { flex: 1, padding: 16, gap: 16 },
  card: {
    backgroundColor: '#0A0A0A', borderRadius: RADIUS.sm, padding: 16,
    borderWidth: 1, borderColor: '#222222',
  },
  cardLabel: { fontFamily: 'monospace', fontSize: 10, color: '#FFB000', letterSpacing: 1, fontWeight: '700', marginBottom: 4 },
  hint: { fontFamily: 'monospace', fontSize: 11, color: '#555555', marginBottom: 12 },
  codeInput: {
    fontFamily: 'monospace', fontSize: 28, color: '#00FF66', textAlign: 'center',
    backgroundColor: '#111111', borderRadius: 4, borderWidth: 1, borderColor: '#333333',
    paddingVertical: 14, letterSpacing: 6, fontWeight: '700',
  },
  nameInput: {
    fontFamily: 'monospace', fontSize: 14, color: '#E0E0E0',
    backgroundColor: '#111111', borderRadius: 4, borderWidth: 1, borderColor: '#333333',
    padding: 12,
  },
  actions: { gap: 12 },
  joinBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#00FF66', borderRadius: RADIUS.sm, paddingVertical: 14,
  },
  joinBtnDisabled: { opacity: 0.3 },
  joinBtnText: { fontFamily: 'monospace', fontSize: 13, color: '#000000', fontWeight: '700', letterSpacing: 1 },
  scanBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#1F1F1F', borderRadius: RADIUS.sm, paddingVertical: 14,
    borderWidth: 1, borderColor: '#FFB000',
  },
  scanBtnText: { fontFamily: 'monospace', fontSize: 13, color: '#FFB000', fontWeight: '700', letterSpacing: 1 },
  cameraContainer: { flex: 1 },
  camera: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scanFrame: { width: 240, height: 240, borderWidth: 2, borderColor: '#FFB000', borderRadius: 12 },
  instruction: {
    fontFamily: 'monospace', fontSize: 12, color: '#FFFFFF', marginTop: 16,
    textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  stopCameraBtn: {
    position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.85)',
    paddingVertical: 14, alignItems: 'center',
  },
  stopCameraBtnText: { fontFamily: 'monospace', fontSize: 12, color: '#FFB000', letterSpacing: 1 },
});
