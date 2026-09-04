import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActiveMode } from '../context/LedgerContext';

interface DockProps {
  mode: ActiveMode;
  activeTripId: string | null;
  onSettle: () => void;
  onQR: () => void;
}

interface TabItem {
  key: string;
  label: string;
  route: string;
}

const TABS: TabItem[] = [
  { key: 'home', label: '[/home]', route: '/' },
  { key: 'ledger', label: '[#ledger]', route: '/search' },
  { key: 'budget', label: '[$ budget]', route: '/budget' },
  { key: 'sys', label: '[⚙ sys]', route: '/settings' },
];

export function Dock({ mode, activeTripId, onSettle, onQR }: DockProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  function getActiveKey(): string {
    if (pathname === '/') return 'home';
    if (pathname.startsWith('/search')) return 'ledger';
    if (pathname.startsWith('/budget') || pathname.startsWith('/goals') || pathname.startsWith('/recurring')) return 'budget';
    if (pathname.startsWith('/settings') || pathname.startsWith('/profile')) return 'sys';
    return '';
  }

  const activeKey = getActiveKey();

  function handlePress(tab: TabItem) {
    Haptics.selectionAsync();
    if (tab.key === 'home') {
      router.push('/');
    } else {
      router.push(tab.route as any);
    }
  }

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.row}>
        {TABS.map((tab) => {
          const isActive = activeKey === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.item, isActive && styles.itemActive]}
              onPress={() => handlePress(tab)}
              activeOpacity={0.7}
            >
              <Text style={[styles.label, isActive && styles.labelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: '#222222',
    backgroundColor: '#0A0A0A',
  },
  row: {
    flexDirection: 'row',
    height: 48,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  itemActive: {
    borderBottomColor: '#00FF66',
  },
  label: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#555555',
    letterSpacing: 0.5,
  },
  labelActive: {
    color: '#00FF66',
    fontWeight: '700',
  },
});
