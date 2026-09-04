import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Trip } from '../types';
import { encodeTripMesh, serializeFrame, parseFrame } from '../lib/qrMesh';
import { QRAccumulator, type AccumulatorResult } from '../lib/qrAccumulator';
import { AnimatedQR } from './AnimatedQR';
import { mergeTripFromPayload } from '../lib/database';

const { width: SCREEN_W } = Dimensions.get('window');

interface P2PSyncModalProps {
  visible: boolean;
  trip: Trip;
  onClose: () => void;
  onSyncComplete?: () => void;
}

type SyncTab = 'qr-broadcast' | 'qr-scan';

export function P2PSyncModal({ visible, trip, onClose, onSyncComplete }: P2PSyncModalProps) {
  const [activeTab, setActiveTab] = useState<SyncTab>('qr-broadcast');
  const [scanResult, setScanResult] = useState<AccumulatorResult | null>(null);
  const [mergeStatus, setMergeStatus] = useState<{ inserted: number; updated: number } | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [showCamera, setShowCamera] = useState(false);
  const accumulatorRef = useRef(new QRAccumulator());

  useEffect(() => {
    if (visible) {
      setScanResult(null);
      setMergeStatus(null);
      setShowCamera(false);
      accumulatorRef.current.reset();
    }
  }, [visible]);

  const tripJson = JSON.stringify(trip);
  const mesh = encodeTripMesh(tripJson);

  function handleQRScanned({ data }: { data: string }) {
    const result = accumulatorRef.current.feed(data);
    setScanResult(result);

    if (result.status === 'complete' && result.payload) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      handleMergePayload(result.payload);
    } else if (result.status === 'partial') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else if (result.status === 'error') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  async function handleMergePayload(payload: string) {
    try {
      const incoming = JSON.parse(payload);
      if (incoming && incoming.id) {
        const result = await mergeTripFromPayload(incoming);
        setMergeStatus(result);
        onSyncComplete?.();
        setShowCamera(false);
      }
    } catch (err) {
      console.warn('[P2P] Merge failed:', err);
      setScanResult({
        status: 'error',
        progress: accumulatorRef.current.getProgress(),
        payload: null,
        error: 'Failed to parse or merge payload',
      });
    }
  }

  async function handleStartScan() {
    if (!cameraPermission?.granted) {
      const { granted } = await requestCameraPermission();
      if (!granted) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
    }
    setShowCamera(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>OFFLINE P2P SYNC</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#888888" />
            </TouchableOpacity>
          </View>

          {/* Tab Bar */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'qr-broadcast' && styles.tabActive]}
              onPress={() => { setActiveTab('qr-broadcast'); setShowCamera(false); }}
            >
              <Ionicons name="radio-outline" size={14} color={activeTab === 'qr-broadcast' ? '#00FF66' : '#888888'} />
              <Text style={[styles.tabText, activeTab === 'qr-broadcast' && styles.tabTextActive]}>
                BROADCAST
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'qr-scan' && styles.tabActive]}
              onPress={() => setActiveTab('qr-scan')}
            >
              <Ionicons name="scan-outline" size={14} color={activeTab === 'qr-scan' ? '#FFB000' : '#888888'} />
              <Text style={[styles.tabText, activeTab === 'qr-scan' && styles.tabTextActive]}>
                SCANNER
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          {activeTab === 'qr-broadcast' ? (
            <View style={styles.broadcastContent}>
              <Text style={styles.broadcastHint}>
                Have your friend scan this from the Money Voice app
              </Text>
              <AnimatedQR data={tripJson} />
              <View style={styles.meshInfo}>
                <Text style={styles.meshInfoText}>
                  {mesh.frames.length} frame{mesh.frames.length > 1 ? 's' : ''} · {mesh.totalPayloadBytes.toLocaleString()} bytes
                </Text>
                {mesh.frames.length > 1 && (
                  <Text style={styles.meshWarning}>
                    Animated QR cycling at ~6 FPS
                  </Text>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.scannerContent}>
              {!showCamera ? (
                <View style={styles.scannerIdle}>
                  <Ionicons name="scan" size={48} color="#FFB000" />
                  <Text style={styles.scannerTitle}>READY TO SCAN</Text>
                  <Text style={styles.scannerSubtitle}>
                    Point camera at a Money Voice QR code
                  </Text>
                  <TouchableOpacity style={styles.scanBtn} onPress={handleStartScan}>
                    <Ionicons name="camera-outline" size={18} color="#000000" />
                    <Text style={styles.scanBtnText}>ACTIVATE CAMERA</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.cameraContainer}>
                  <CameraView
                    style={styles.camera}
                    onBarcodeScanned={handleQRScanned}
                    barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  />
                  {/* Progress overlay */}
                  <View style={styles.progressOverlay}>
                    <Text style={styles.progressTitle}>
                      {scanResult?.status === 'complete' ? 'SYNC COMPLETE' : 'INGESTING...'}
                    </Text>
                    {scanResult && (
                      <>
                        <View style={styles.progressBarBg}>
                          <View style={[styles.progressBarFill, { width: `${scanResult.progress.percent}%` }]} />
                        </View>
                        <Text style={styles.progressText}>
                          [{scanResult.progress.bar}] {scanResult.progress.percent}%
                        </Text>
                        <Text style={styles.progressFrames}>
                          FRAME {scanResult.progress.receivedCount}/{scanResult.progress.totalFrames}
                          {scanResult.progress.hash && ` // 0x${scanResult.progress.hash}`}
                        </Text>
                      </>
                    )}
                    {scanResult?.status === 'error' && (
                      <Text style={styles.errorText}>{scanResult.error}</Text>
                    )}
                    {mergeStatus && (
                      <Text style={styles.mergeText}>
                        MERGED: {mergeStatus.inserted} new, {mergeStatus.updated} updated
                      </Text>
                    )}
                    <TouchableOpacity style={styles.stopBtn} onPress={() => { setShowCamera(false); accumulatorRef.current.reset(); setScanResult(null); }}>
                      <Text style={styles.stopBtnText}>STOP SCANNING</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Close */}
          <TouchableOpacity style={styles.closeBtnBottom} onPress={onClose}>
            <Text style={styles.closeBtnBottomText}>CLOSE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modal: {
    backgroundColor: '#0A0A0A', borderRadius: 8, borderWidth: 1, borderColor: '#222222',
    maxHeight: '90%', overflow: 'hidden',
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#222222',
  },
  title: { fontFamily: 'monospace', fontSize: 14, color: '#00FF66', fontWeight: '700', letterSpacing: 2 },
  closeBtn: { padding: 4 },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#222222' },
  tab: {
    flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 6, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#00FF66' },
  tabText: { fontFamily: 'monospace', fontSize: 11, color: '#888888', letterSpacing: 1 },
  tabTextActive: { color: '#00FF66', fontWeight: '700' },
  broadcastContent: { alignItems: 'center', padding: 16, gap: 12 },
  broadcastHint: { fontFamily: 'monospace', fontSize: 11, color: '#555555', textAlign: 'center' },
  meshInfo: {
    backgroundColor: '#111111', borderRadius: 4, paddingVertical: 6, paddingHorizontal: 12,
    borderWidth: 1, borderColor: '#222222',
  },
  meshInfoText: { fontFamily: 'monospace', fontSize: 10, color: '#888888' },
  meshWarning: { fontFamily: 'monospace', fontSize: 10, color: '#FFB000', marginTop: 4 },
  scannerContent: { minHeight: 300 },
  scannerIdle: {
    alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12,
  },
  scannerTitle: { fontFamily: 'monospace', fontSize: 16, color: '#FFB000', fontWeight: '700', letterSpacing: 2 },
  scannerSubtitle: { fontFamily: 'monospace', fontSize: 11, color: '#555555', textAlign: 'center' },
  scanBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFB000', borderRadius: 4, paddingVertical: 12, paddingHorizontal: 20, marginTop: 8,
  },
  scanBtnText: { fontFamily: 'monospace', fontSize: 12, color: '#000000', fontWeight: '700' },
  cameraContainer: { height: 320, position: 'relative' },
  camera: { flex: 1 },
  progressOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.85)', padding: 12, gap: 6,
  },
  progressTitle: { fontFamily: 'monospace', fontSize: 12, color: '#00FF66', fontWeight: '700', letterSpacing: 1 },
  progressBarBg: { height: 6, backgroundColor: '#1F1F1F', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: 6, backgroundColor: '#00FF66', borderRadius: 3 },
  progressText: { fontFamily: 'monospace', fontSize: 10, color: '#888888' },
  progressFrames: { fontFamily: 'monospace', fontSize: 10, color: '#555555' },
  errorText: { fontFamily: 'monospace', fontSize: 11, color: '#FF3333' },
  mergeText: { fontFamily: 'monospace', fontSize: 11, color: '#00FF66', fontWeight: '700' },
  stopBtn: {
    backgroundColor: '#333333', borderRadius: 4, paddingVertical: 8, alignItems: 'center', marginTop: 4,
  },
  stopBtnText: { fontFamily: 'monospace', fontSize: 11, color: '#888888', fontWeight: '700' },
  closeBtnBottom: {
    padding: 12, borderTopWidth: 1, borderTopColor: '#222222', alignItems: 'center',
  },
  closeBtnBottomText: { fontFamily: 'monospace', fontSize: 12, color: '#888888', letterSpacing: 1 },
});
