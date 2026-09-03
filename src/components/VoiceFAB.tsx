import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, Animated, StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VoiceEngineState } from '../types';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../constants';

interface VoiceFABProps {
  state: VoiceEngineState;
  onPress: () => void;
  onLongPress?: () => void;
  label?: string;
}

export function VoiceFAB({ state, onPress, onLongPress, label }: VoiceFABProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const isActive = state === 'listening';
  const isProcessing = state === 'processing';
  const isConfirming = state === 'confirming';

  useEffect(() => {
    if (isActive) {
      // Pulsing ring animation
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();

      // Glow
      const glow = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      glow.start();

      return () => {
        pulse.stop();
        glow.stop();
        pulseAnim.setValue(1);
        glowAnim.setValue(0);
      };
    }
  }, [isActive]);

  const bgColor = isActive
    ? COLORS.danger
    : isProcessing
      ? COLORS.accent
      : isConfirming
        ? COLORS.success
        : COLORS.primary;

  const iconName: keyof typeof Ionicons.glyphMap = isActive
    ? 'mic'
    : isProcessing
      ? 'hourglass-outline'
      : 'mic-outline';

  return (
    <View style={styles.container}>
      {label && (
        <View style={styles.labelContainer}>
          <Text style={styles.label}>{label}</Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.fabTouch}
        onPress={onPress}
        onLongPress={onLongPress}
        activeOpacity={0.7}
      >
        {/* Pulse ring (only when listening) */}
        {isActive && (
          <Animated.View
            style={[
              styles.pulseRing,
              {
                backgroundColor: bgColor,
                transform: [{ scale: pulseAnim }],
                opacity: glowAnim,
              },
            ]}
          />
        )}

        {/* Main button */}
        <Animated.View
          style={[
            styles.fab,
            {
              backgroundColor: bgColor,
              transform: [{ scale: isActive ? pulseAnim : new Animated.Value(1) }],
            },
          ]}
        >
          <Ionicons name={iconName} size={28} color={COLORS.white} />
        </Animated.View>

        {/* Status indicator dot */}
        <View
          style={[
            styles.statusDot,
            {
              backgroundColor: isActive
                ? COLORS.danger
                : isProcessing
                  ? COLORS.accent
                  : COLORS.success,
            },
          ]}
        />
      </TouchableOpacity>

      {/* Terminal-style label */}
      <Text style={styles.terminalLabel}>
        {state === 'idle' && '[ REC ]'}
        {state === 'listening' && '[ LIVE ]'}
        {state === 'processing' && '[ PARSE ]'}
        {state === 'confirming' && '[ CONFIRM ]'}
        {state === 'writing' && '[ WRITE ]'}
        {state === 'error' && '[ ERROR ]'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  labelContainer: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    fontFamily: 'monospace',
  },
  fabTouch: {
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  statusDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: COLORS.bg,
  },
  terminalLabel: {
    fontFamily: 'monospace',
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    letterSpacing: 1,
  },
});
