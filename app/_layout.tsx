import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { initDatabase } from '../src/lib/database';
import { LedgerProvider } from '../src/context/LedgerContext';
import { isOnboardingComplete, hasPinLock } from '../src/lib/profile';
import { View, ActivityIndicator } from 'react-native';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [ready, setReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await initDatabase();
        const onboarded = await isOnboardingComplete();
        const hasPin = await hasPinLock();

        if (!onboarded) {
          setInitialRoute('onboarding');
        } else if (hasPin && (segments as string[]).length === 0) {
          setInitialRoute('pin-lock');
        } else {
          setInitialRoute('index');
        }
      } catch {
        setInitialRoute('index');
      } finally {
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (ready && initialRoute && initialRoute !== 'index') {
      router.replace(initialRoute === 'pin-lock' ? '/pin-lock' : '/onboarding');
    }
  }, [ready, initialRoute]);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="small" color="#00FF66" />
      </View>
    );
  }

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
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="pin-lock" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="stats" />
        <Stack.Screen name="budget" />
        <Stack.Screen name="goals" />
        <Stack.Screen name="search" />
        <Stack.Screen name="recurring" />
        <Stack.Screen name="reminders" />
        <Stack.Screen name="trips" />
        <Stack.Screen name="settle" />
        <Stack.Screen name="scan" options={{ presentation: 'modal' }} />
        <Stack.Screen name="settings" />
      </Stack>
    </LedgerProvider>
  );
}
