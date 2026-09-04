import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ActiveMode } from '../context/LedgerContext';

interface DockProps {
  mode: ActiveMode;
  activeTripId: string | null;
  onSettle: () => void;
  onQR: () => void;
}

export function Dock({ mode, activeTripId, onSettle, onQR }: DockProps) {
  const router = useRouter();

  const items = [
    { icon: 'stats-chart-outline' as const, label: 'STATS', onPress: () => router.push('/stats') },
    { icon: 'wallet-outline' as const, label: 'BUDGET', onPress: () => router.push('/budget') },
    { icon: 'flag-outline' as const, label: 'GOALS', onPress: () => router.push('/goals') },
    { icon: 'repeat-outline' as const, label: 'RECUR', onPress: () => router.push('/recurring') },
    { icon: 'search-outline' as const, label: 'SEARCH', onPress: () => router.push('/search') },
    { icon: 'notifications-outline' as const, label: 'ALERT', onPress: () => router.push('/reminders') },
    { icon: 'person-outline' as const, label: 'USER', onPress: () => router.push('/profile') },
    { icon: 'settings-outline' as const, label: 'CONFIG', onPress: () => router.push('/settings') },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {items.map((item, i) => (
          <TouchableOpacity key={i} style={styles.item} onPress={item.onPress}>
            <Ionicons name={item.icon} size={16} color="#888888" />
            <Text style={styles.label}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: '#222222',
    backgroundColor: '#0A0A0A',
    paddingBottom: Platform.OS === 'android' ? 12 : 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  item: {
    alignItems: 'center',
    gap: 2,
  },
  label: {
    fontFamily: 'monospace',
    fontSize: 8,
    color: '#888888',
    letterSpacing: 0.5,
  },
});
