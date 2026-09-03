import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ExpenseRow } from '../../src/components/ExpenseRow';
import { EmptyState } from '../../src/components/EmptyState';
import {
  getTripById,
  addMember,
  deleteTrip,
  deleteExpense,
} from '../../src/lib/database';

import { simplifyDebts } from '../../src/lib/debt';
import { Trip, CURRENCIES } from '../../src/types';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../src/constants';

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [newMemberName, setNewMemberName] = useState('');
  const [showMemberInput, setShowMemberInput] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadTrip();
    }, [id])
  );

  async function loadTrip() {
    if (!id) return;
    const t = await getTripById(id);
    setTrip(t);
  }

  async function handleAddMember() {
    if (!newMemberName.trim() || !id) return;
    await addMember(id, newMemberName.trim());
    setNewMemberName('');
    setShowMemberInput(false);
    loadTrip();
  }

  async function handleDeleteExpense(expenseId: string) {
    Alert.alert('Delete Expense', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteExpense(expenseId);
          loadTrip();
        },
      },
    ]);
  }

  async function handleDeleteTrip() {
    Alert.alert('Delete Trip', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTrip(id!);
          router.back();
        },
      },
    ]);
  }

  function handleExportQR() {
    if (!id) return;
    router.push(`/trips/share-qr/${id}`);
  }

  if (!trip) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Loading...</Text>
      </View>
    );
  }

  const currency = CURRENCIES[trip.currency] || { symbol: '₹', code: 'INR' };
  const totalExpenses = trip.expenses.reduce((sum, e) => sum + e.amount, 0);
  const settlements = simplifyDebts(trip.members, trip.expenses);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.tripName}>{trip.name}</Text>
          <Text style={styles.tripMeta}>
            {currency.symbol}{totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })} total · {trip.currency}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerBtn} onPress={handleExportQR}>
            <Ionicons name="qr-code-outline" size={18} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerBtn, { borderColor: COLORS.danger }]}
            onPress={handleDeleteTrip}
          >
            <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Members */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Members</Text>
          <TouchableOpacity onPress={() => setShowMemberInput(!showMemberInput)}>
            <Ionicons name="add-circle" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {showMemberInput && (
          <View style={styles.memberInput}>
            <TextInput
              style={styles.input}
              value={newMemberName}
              onChangeText={setNewMemberName}
              placeholder="Member name"
              placeholderTextColor={COLORS.textMuted}
              autoFocus
            />
            <TouchableOpacity style={styles.addBtn} onPress={handleAddMember}>
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.memberScroll}>
          {trip.members.map((m) => (
            <View key={m.id} style={styles.memberChip}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberAvatarText}>{m.name[0]}</Text>
              </View>
              <Text style={styles.memberName}>{m.name}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Expenses */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Expenses</Text>
        {trip.members.length >= 2 && (
          <TouchableOpacity
            style={styles.addExpenseBtn}
            onPress={() => router.push(`/trips/expense/${trip.id}`)}
          >
            <Ionicons name="add" size={18} color={COLORS.white} />
            <Text style={styles.addExpenseBtnText}>Add</Text>
          </TouchableOpacity>
        )}
      </View>

      {trip.expenses.length === 0 ? (
        <EmptyState
          icon="receipt-outline"
          title="No expenses yet"
          subtitle="Add members first, then start logging expenses."
        />
      ) : (
        <FlatList
          data={trip.expenses}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ExpenseRow
              expense={item}
              members={trip.members}
              currency={trip.currency}
              onDelete={() => handleDeleteExpense(item.id)}
            />
          )}
          contentContainerStyle={styles.list}
        />
      )}

      {/* Settlements Button */}
      {settlements.length > 0 && (
        <TouchableOpacity
          style={styles.settleBtn}
          onPress={() => router.push(`/settle/${trip.id}`)}
        >
          <Ionicons name="cash-outline" size={20} color={COLORS.white} />
          <Text style={styles.settleBtnText}>
            View Settlements ({settlements.length})
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  loading: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xxxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  tripName: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  tripMeta: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  section: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  memberInput: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
  },
  addBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    justifyContent: 'center',
  },
  addBtnText: {
    color: COLORS.white,
    fontWeight: '600',
  },
  memberScroll: {
    flexDirection: 'row',
  },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    marginRight: SPACING.sm,
    gap: SPACING.xs,
  },
  memberAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
  },
  memberName: {
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
  },
  addExpenseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  addExpenseBtnText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
  list: {
    paddingBottom: 100,
  },
  settleBtn: {
    position: 'absolute',
    bottom: SPACING.xl,
    left: SPACING.lg,
    right: SPACING.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.lg,
  },
  settleBtnText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
  },
});
