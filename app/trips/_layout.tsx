import React from 'react';
import { Stack } from 'expo-router';
import { COLORS } from '../../src/constants';

export default function TripsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.bg },
        headerTintColor: COLORS.text,
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: COLORS.bg },
      }}
    >
      <Stack.Screen name="new" options={{ title: 'New Trip' }} />
      <Stack.Screen name="[id]" options={{ title: 'Trip Details' }} />
      <Stack.Screen
        name="expense/[id]"
        options={{ title: 'Add Expense', presentation: 'modal' }}
      />
    </Stack>
  );
}
