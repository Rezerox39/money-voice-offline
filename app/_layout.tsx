import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { initDatabase } from '../src/lib/database';
import { LedgerProvider } from '../src/context/LedgerContext';

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
        <Stack.Screen name="stats" />
        <Stack.Screen name="budget" />
        <Stack.Screen name="search" />
        <Stack.Screen name="recurring" />
        <Stack.Screen name="trips" />
        <Stack.Screen name="settle" />
        <Stack.Screen name="scan" options={{ presentation: 'modal' }} />
        <Stack.Screen name="settings" />
      </Stack>
    </LedgerProvider>
  );
}
