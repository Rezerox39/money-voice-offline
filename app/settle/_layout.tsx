import React from 'react';
import { Stack } from 'expo-router';
import { COLORS } from '../../src/constants';

export default function SettleLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.bg },
        headerTintColor: COLORS.text,
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: COLORS.bg },
      }}
    >
      <Stack.Screen name="[tripId]" options={{ title: 'Settlements' }} />
    </Stack>
  );
}
