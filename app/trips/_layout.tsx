import React from 'react';
import { Stack } from 'expo-router';

export default function TripsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#000000' },
        animation: 'none',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="new" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="expense/[id]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="share-qr/[id]" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
