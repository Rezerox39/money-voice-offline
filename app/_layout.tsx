// ─────────────────────────────────────────────────────────────────
// _layout.tsx — BitChat AMOLED Shell
// Pure black background, zero navigation headers.
// Persistent top status line + bottom utilitarian dock.
// ─────────────────────────────────────────────────────────────────

import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet } from 'react-native';
import { initDatabase } from '../src/lib/database';
import { LedgerProvider } from '../src/context/LedgerContext';
import { COLORS } from '../src/constants';

export default function RootLayout() {
  useEffect(() => {
    initDatabase();
  }, []);

  return (
    <LedgerProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#000000' },
          animation: 'none',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="trips" />
        <Stack.Screen name="settle" />
        <Stack.Screen name="scan" options={{ presentation: 'modal' }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
      </Stack>
    </LedgerProvider>
  );
}
