// ─────────────────────────────────────────────────────────────────
// AnimatedQR.tsx — Multi-frame animated QR display
// Cycles through chunked frames at ~3.5 FPS for large payloads.
// Shows progress ring beneath: BROADCASTING CHUNK [2/4] · 3.5 FPS
// ─────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { encodeTripMesh, serializeFrame } from '../lib/qrMesh';

interface AnimatedQRProps {
  data: string; // Original JSON payload (pre-compression)
  frameInterval?: number; // ms per frame (default 280)
}

export function AnimatedQR({ data, frameInterval = 280 }: AnimatedQRProps) {
  const [frameIndex, setFrameIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const mesh = useMemo(() => encodeTripMesh(data), [data]);

  // Cycle frames
  useEffect(() => {
    if (mesh.frames.length <= 1) return; // Single frame — no animation needed

    intervalRef.current = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % mesh.frames.length);
    }, frameInterval);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [mesh.frames.length, frameInterval]);

  // Pulse animation on frame change
  useEffect(() => {
    if (mesh.frames.length <= 1) return;
    pulseAnim.setValue(0.85);
    Animated.timing(pulseAnim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [frameIndex, mesh.frames.length]);

  const currentFrame = mesh.frames[frameIndex];
  const qrValue = serializeFrame(currentFrame);
  const fps = (1000 / frameInterval).toFixed(1);

  return (
    <View style={styles.container}>
      <View style={styles.qrWrapper}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <QRCode
            value={qrValue}
            size={240}
            backgroundColor="#FFFFFF"
            color="#000000"
            quietZone={8}
          />
        </Animated.View>
      </View>

      {mesh.frames.length > 1 && (
        <View style={styles.progressSection}>
          <Text style={styles.progressLabel}>
            BROADCASTING CHUNK [{frameIndex + 1}/{mesh.frames.length}] · {fps} FPS
          </Text>
          <View style={styles.progressBar}>
            {mesh.frames.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.progressDot,
                  i === frameIndex && styles.progressDotActive,
                  i < frameIndex && styles.progressDotPast,
                ]}
              />
            ))}
          </View>
          <Text style={styles.payloadSize}>
            {mesh.totalPayloadBytes.toLocaleString()} bytes compressed
          </Text>
        </View>
      )}

      {mesh.frames.length === 1 && (
        <Text style={styles.singleFrame}>Single frame · {mesh.totalPayloadBytes.toLocaleString()} bytes</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 12,
  },
  qrWrapper: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  progressSection: {
    alignItems: 'center',
    gap: 8,
  },
  progressLabel: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#00FF66',
    letterSpacing: 0.5,
  },
  progressBar: {
    flexDirection: 'row',
    gap: 4,
  },
  progressDot: {
    width: 24,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#333333',
  },
  progressDotActive: {
    backgroundColor: '#00FF66',
  },
  progressDotPast: {
    backgroundColor: '#004422',
  },
  payloadSize: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#555555',
  },
  singleFrame: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#555555',
    marginTop: 4,
  },
});
