import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { initDatabase } from '../src/lib/database';
import { COLORS } from '../src/constants';

export default function RootLayout() {
  useEffect(() => {
    initDatabase();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.bg },
          headerTintColor: COLORS.text,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: COLORS.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Money Voice' }} />
        <Stack.Screen name="trips" options={{ headerShown: false }} />
        <Stack.Screen name="settle" options={{ headerShown: false }} />
        <Stack.Screen
          name="scan"
          options={{ title: 'Scan QR', presentation: 'modal' }}
        />
      </Stack>
    </>
  );
}
