import React, { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SQLiteProvider } from 'expo-sqlite';
import { initDatabase } from '../src/lib/database';
import { LedgerProvider } from '../src/context/LedgerContext';
import { isOnboardingComplete, hasPinLock } from '../src/lib/profile';
import { View, ActivityIndicator } from 'react-native';

const DB_NAME = 'moneyvoice.db';

async function onDatabaseInit(db: any) {
  await initDatabase();
}

export default function RootLayout() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const onboarded = await isOnboardingComplete();
        const hasPin = await hasPinLock();
        if (!onboarded) {
          setInitialRoute('onboarding');
        } else if (hasPin) {
          setInitialRoute('pin-lock');
        } else {
          setInitialRoute('index');
        }
      } catch (err) {
        console.warn('[LAYOUT] Onboarding check failed:', err);
        setInitialRoute('onboarding');
      } finally {
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (ready && initialRoute && initialRoute !== 'index') {
      const target = initialRoute === 'pin-lock' ? '/pin-lock' : '/onboarding';
      router.replace(target);
    }
  }, [ready, initialRoute]);

  if (!ready) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <View style={{ flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="small" color="#00FF66" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SQLiteProvider databaseName={DB_NAME} onInit={onDatabaseInit}>
        <LedgerProvider>
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
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
