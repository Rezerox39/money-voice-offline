import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { createTrip } from '../../src/lib/database';
import { CURRENCIES } from '../../src/types';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../src/constants';

export default function NewTripScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('INR');

  const currencyCodes = Object.keys(CURRENCIES);

  async function handleCreate() {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter a trip name.');
      return;
    }

    const trip = await createTrip(name.trim(), currency);
    router.replace(`/trips/${trip.id}`);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Trip Name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g., Goa Weekend 2026"
        placeholderTextColor={COLORS.textMuted}
      />

      <Text style={styles.label}>Currency</Text>
      <View style={styles.currencyRow}>
        {currencyCodes.map((code) => (
          <TouchableOpacity
            key={code}
            style={[
              styles.currencyBtn,
              currency === code && styles.currencyBtnActive,
            ]}
            onPress={() => setCurrency(code)}
          >
            <Text
              style={[
                styles.currencyText,
                currency === code && styles.currencyTextActive,
              ]}
            >
              {CURRENCIES[code].symbol} {code}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.button, !name.trim() && styles.buttonDisabled]}
        onPress={handleCreate}
        disabled={!name.trim()}
      >
        <Ionicons name="checkmark" size={20} color={COLORS.white} />
        <Text style={styles.buttonText}>Create Trip</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    padding: SPACING.xl,
    gap: SPACING.lg,
  },
  label: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    color: COLORS.text,
    fontSize: FONT_SIZE.lg,
  },
  currencyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  currencyBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  currencyBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  currencyText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
  },
  currencyTextActive: {
    color: COLORS.white,
  },
  button: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.lg,
    marginTop: SPACING.lg,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
  },
});
