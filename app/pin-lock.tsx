import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { verifyPinCode, hasPinLock } from '../src/lib/profile';

export default function PinLockScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    (async () => {
      const hasPin = await hasPinLock();
      setIsLocked(hasPin);
      if (!hasPin) router.replace('/');
    })();
  }, []);

  const handleDigit = useCallback(async (d: string) => {
    if (error) { setError(false); setPin(''); }
    const next = pin + d;
    setPin(next);

    if (next.length >= 4) {
      const valid = await verifyPinCode(next);
      if (valid) {
        router.replace('/');
      } else {
        setError(true);
        setTimeout(() => { setPin(''); setError(false); }, 800);
      }
    }
  }, [pin, error, router]);

  const handleDelete = useCallback(() => {
    setPin(prev => prev.slice(0, -1));
  }, []);

  if (!isLocked) return null;

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 24), paddingBottom: Math.max(insets.bottom, 16) }]}>
      <Ionicons name="lock-closed" size={40} color={error ? '#FF3333' : '#00FF66'} />
      <Text style={[styles.title, error && styles.titleError]}>
        {error ? 'INCORRECT PIN' : 'ENTER PIN'}
      </Text>

      <View style={styles.dotsRow}>
        {[0, 1, 2, 3].map(i => (
          <View key={i} style={[styles.dot, pin.length > i && styles.dotFilled, error && styles.dotError]} />
        ))}
      </View>

      <View style={styles.keypad}>
        {digits.map((d, i) => {
          if (d === '') return <View key={i} style={styles.keyEmpty} />;
          if (d === '⌫') return (
            <TouchableOpacity key={i} style={styles.key} onPress={handleDelete}>
              <Ionicons name="backspace-outline" size={22} color="#888888" />
            </TouchableOpacity>
          );
          return (
            <TouchableOpacity key={i} style={styles.key} onPress={() => handleDigit(d)}>
              <Text style={styles.keyText}>{d}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center', gap: 24,
  },
  title: {
    fontFamily: 'monospace', fontSize: 16, color: '#00FF66', letterSpacing: 3, fontWeight: '700',
  },
  titleError: { color: '#FF3333' },
  dotsRow: { flexDirection: 'row', gap: 16, marginVertical: 16 },
  dot: {
    width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#333333',
  },
  dotFilled: { backgroundColor: '#00FF66', borderColor: '#00FF66' },
  dotError: { backgroundColor: '#FF3333', borderColor: '#FF3333' },
  keypad: {
    flexDirection: 'row', flexWrap: 'wrap', width: 260, justifyContent: 'center', gap: 12,
  },
  key: {
    width: 70, height: 70, borderRadius: 35, backgroundColor: '#1F1F1F',
    borderWidth: 1, borderColor: '#333333', justifyContent: 'center', alignItems: 'center',
  },
  keyText: {
    fontFamily: 'monospace', fontSize: 24, color: '#E0E0E0', fontWeight: '700',
  },
  keyEmpty: { width: 70, height: 70 },
});
