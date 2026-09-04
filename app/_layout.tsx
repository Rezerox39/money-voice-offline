import React, { useEffect, useState, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SQLiteProvider } from 'expo-sqlite';
import { initDatabase } from '../src/lib/database';
import { LedgerProvider } from '../src/context/LedgerContext';
import { isOnboardingComplete, hasPinLock } from '../src/lib/profile';
import { View, ActivityIndicator } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { ParticleField } from '../src/components/ParticleField';

const DB_NAME = 'moneyvoice_v2.db';

async function onDatabaseInit(database: any) {
  await initDatabase(database);
}

function RootNavigationGate() {
  const router = useRouter();
  const segments = useSegments();
  const [isReady, setIsReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState<string | null>(null);
  const hasNavigated = useRef(false);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const onboarded = await isOnboardingComplete();
        const hasPin = await hasPinLock();
        if (!cancelled) {
          if (!onboarded) {
            setInitialRoute('onboarding');
          } else if (hasPin) {
            setInitialRoute('pin-lock');
          } else {
            setInitialRoute('index');
          }
        }
      } catch (err) {
        console.warn('[LAYOUT] Onboarding check failed:', err);
        if (!cancelled) setInitialRoute('onboarding');
      } finally {
        if (!cancelled) setIsReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isReady || initialRoute === null || hasNavigated.current) return;

    const currentRoute = segments[0] as string | undefined;

    // Only navigate if we're not already on the correct route
    if (initialRoute === 'onboarding' && currentRoute !== 'onboarding') {
      hasNavigated.current = true;
      router.replace('/onboarding');
    } else if (initialRoute === 'pin-lock' && currentRoute !== 'pin-lock') {
      hasNavigated.current = true;
      router.replace('/pin-lock');
    } else if (initialRoute === 'index' && currentRoute && currentRoute !== 'index') {
      hasNavigated.current = true;
      router.replace('/');
    } else {
      // Already on the correct route — mark as navigated to prevent re-firing
      hasNavigated.current = true;
    }
  }, [isReady, initialRoute, segments, router]);

  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#00FF66" />
      </View>
    );
  }

  return (
    <>
      <ParticleField active={true} count={20} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#000000' },
          animation: 'fade',
          animationDuration: 200,
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
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SQLiteProvider databaseName={DB_NAME} onInit={onDatabaseInit}>
        <LedgerProvider>
          <RootNavigationGate />
        </LedgerProvider>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
