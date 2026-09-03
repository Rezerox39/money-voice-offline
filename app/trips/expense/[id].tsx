import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getTripById, addExpense } from '../../../src/lib/database';
import { Trip, Member, CATEGORIES, SplitShare } from '../../../src/types';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../../src/constants';

export default function AddExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState<string>('');
  const [category, setCategory] = useState<string>('Food');
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>('equal');
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({});

  useEffect(() => {
    loadTrip();
  }, [id]);

  async function loadTrip() {
    if (!id) return;
    const t = await getTripById(id);
    setTrip(t);
    if (t && t.members.length > 0) {
      setPaidBy(t.members[0].id);
      const splits: Record<string, string> = {};
      t.members.forEach((m) => (splits[m.id] = ''));
      setCustomSplits(splits);
    }
  }

  function buildSplits(): SplitShare[] {
    if (!trip || !amount) return [];
    const total = parseFloat(amount);
    if (isNaN(total) || total <= 0) return [];

    if (splitMode === 'equal') {
      const perPerson = total / trip.members.length;
      const rounded = Math.round(perPerson * 100) / 100;
      return trip.members.map((m) => ({ memberId: m.id, amount: rounded }));
    }

    return trip.members
      .filter((m) => customSplits[m.id])
      .map((m) => ({
        memberId: m.id,
        amount: parseFloat(customSplits[m.id]) || 0,
      }));
  }

  async function handleSubmit() {
    if (!title.trim() || !amount || !paidBy || !id) {
      Alert.alert('Missing fields', 'Please fill in all required fields.');
      return;
    }

    const splits = buildSplits();
    const total = parseFloat(amount);
    const splitTotal = splits.reduce((s, sp) => s + sp.amount, 0);

    if (Math.abs(splitTotal - total) > 0.02) {
      Alert.alert(
        'Split mismatch',
        `Split total (${splitTotal.toFixed(2)}) doesn't match expense (${total.toFixed(2)}).`
      );
      return;
    }

    await addExpense(id, title.trim(), total, paidBy, splits, category);
    router.back();
  }

  if (!trip) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Title */}
      <Text style={styles.label}>Expense Title *</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="e.g., Dinner, Taxi, Hotel"
        placeholderTextColor={COLORS.textMuted}
      />

      {/* Amount */}
      <Text style={styles.label}>Amount *</Text>
      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={setAmount}
        placeholder="0.00"
        placeholderTextColor={COLORS.textMuted}
        keyboardType="decimal-pad"
      />

      {/* Paid By */}
      <Text style={styles.label}>Paid By *</Text>
      <View style={styles.chipRow}>
        {trip.members.map((m) => (
          <TouchableOpacity
            key={m.id}
            style={[styles.chip, paidBy === m.id && styles.chipActive]}
            onPress={() => setPaidBy(m.id)}
          >
            <Text style={[styles.chipText, paidBy === m.id && styles.chipTextActive]}>
              {m.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Category */}
      <Text style={styles.label}>Category</Text>
      <View style={styles.chipRow}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.chip, category === cat && styles.chipActive]}
            onPress={() => setCategory(cat)}
          >
            <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Split Mode */}
      <Text style={styles.label}>Split Between</Text>
      <View style={styles.splitModeRow}>
        <TouchableOpacity
          style={[styles.splitModeBtn, splitMode === 'equal' && styles.splitModeBtnActive]}
          onPress={() => setSplitMode('equal')}
        >
          <Text style={[styles.splitModeText, splitMode === 'equal' && styles.splitModeTextActive]}>
            Equal Split
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.splitModeBtn, splitMode === 'custom' && styles.splitModeBtnActive]}
          onPress={() => setSplitMode('custom')}
        >
          <Text style={[styles.splitModeText, splitMode === 'custom' && styles.splitModeTextActive]}>
            Custom Amounts
          </Text>
        </TouchableOpacity>
      </View>

      {splitMode === 'equal' ? (
        <View style={styles.equalPreview}>
          <Text style={styles.equalText}>
            {amount
              ? `${(parseFloat(amount) / trip.members.length).toFixed(2)} per person`
              : 'Enter amount to see split'}
          </Text>
        </View>
      ) : (
        <View style={styles.customSplits}>
          {trip.members.map((m) => (
            <View key={m.id} style={styles.customRow}>
              <Text style={styles.customName}>{m.name}</Text>
              <TextInput
                style={styles.customInput}
                value={customSplits[m.id] || ''}
                onChangeText={(v) =>
                  setCustomSplits((prev) => ({ ...prev, [m.id]: v }))
                }
                placeholder="0.00"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="decimal-pad"
              />
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={[styles.submitBtn, (!title.trim() || !amount) && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={!title.trim() || !amount}
      >
        <Ionicons name="checkmark-circle" size={20} color={COLORS.white} />
        <Text style={styles.submitText}>Add Expense</Text>
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
    gap: SPACING.md,
  },
  loading: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xxxl,
  },
  label: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    color: COLORS.text,
    fontSize: FONT_SIZE.lg,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
  },
  chipTextActive: {
    color: COLORS.white,
  },
  splitModeRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  splitModeBtn: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  splitModeBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  splitModeText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
  },
  splitModeTextActive: {
    color: COLORS.white,
  },
  equalPreview: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  equalText: {
    color: COLORS.text,
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
  },
  customSplits: {
    gap: SPACING.sm,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  customName: {
    flex: 1,
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
  },
  customInput: {
    width: 100,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    textAlign: 'right',
  },
  submitBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.lg,
    marginTop: SPACING.xl,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
  },
});
