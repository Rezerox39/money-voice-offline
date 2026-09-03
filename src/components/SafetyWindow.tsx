import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../constants';

interface SafetyWindowProps {
  visible: boolean;
  displayText: string;
  rawTranscript: string;
  countdownSeconds?: number;
  onConfirm: () => void;
  onEdit: () => void;
  onCancel: () => void;
}

export function SafetyWindow({
  visible,
  displayText,
  rawTranscript,
  countdownSeconds = 2,
  onConfirm,
  onEdit,
  onCancel,
}: SafetyWindowProps) {
  const [remaining, setRemaining] = useState(countdownSeconds);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const barAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) {
      setRemaining(countdownSeconds);
      fadeAnim.setValue(0);
      barAnim.setValue(1);
      return;
    }

    // Fade in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    // Countdown bar
    barAnim.setValue(1);
    Animated.timing(barAnim, {
      toValue: 0,
      duration: countdownSeconds * 1000,
      useNativeDriver: false,
    }).start();

    // Countdown timer
    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [visible, countdownSeconds]);

  // Auto-confirm when countdown hits 0
  useEffect(() => {
    if (remaining === 0 && visible) {
      onConfirm();
    }
  }, [remaining, visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
      <View style={styles.container}>
        {/* Terminal header */}
        <View style={styles.header}>
          <Text style={styles.headerText}>{'>>>'} PARSED</Text>
          <TouchableOpacity onPress={onCancel} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close-circle" size={22} color={COLORS.danger} />
          </TouchableOpacity>
        </View>

        {/* Raw transcript */}
        <Text style={styles.rawText}>"{rawTranscript}"</Text>

        {/* Parsed display */}
        <Text style={styles.parsedText}>{displayText}</Text>

        {/* Countdown bar */}
        <View style={styles.countdownContainer}>
          <Animated.View
            style={[
              styles.countdownBar,
              {
                width: barAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>

        {/* Status line */}
        <Text style={styles.statusText}>
          [ AUTO-CONFIRMING IN {remaining}s... ]
        </Text>

        {/* Action buttons */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.editBtn} onPress={onEdit}>
            <Ionicons name="create-outline" size={16} color={COLORS.primary} />
            <Text style={styles.editBtnText}>TAP TO EDIT</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Ionicons name="close-outline" size={16} color={COLORS.danger} />
            <Text style={styles.cancelBtnText}>CANCEL</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    bottom: 120,
    left: SPACING.lg,
    right: SPACING.lg,
    zIndex: 100,
  },
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.primary,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerText: {
    fontFamily: 'monospace',
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
    fontWeight: '700',
  },
  rawText: {
    fontFamily: 'monospace',
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  parsedText: {
    fontFamily: 'monospace',
    fontSize: FONT_SIZE.sm,
    color: COLORS.success,
    lineHeight: 20,
    paddingVertical: SPACING.sm,
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
  },
  countdownContainer: {
    height: 3,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  countdownBar: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  statusText: {
    fontFamily: 'monospace',
    fontSize: FONT_SIZE.xs,
    color: COLORS.accent,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  editBtnText: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  cancelBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  cancelBtnText: {
    color: COLORS.danger,
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
});
