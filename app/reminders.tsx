import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
  ScrollView, Platform, Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Reminder, loadReminders, saveReminder, deleteReminder, toggleReminder, computeNextDueDate, formatFrequency } from '../src/lib/reminders';
import { generateUUID } from '../src/lib/uuid';

const FREQUENCIES: Reminder['frequency'][] = ['daily', 'weekly', 'monthly', 'yearly'];

export default function RemindersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newFreq, setNewFreq] = useState<Reminder['frequency']>('monthly');

  const load = useCallback(async () => {
    const r = await loadReminders();
    setReminders(r);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    if (!newTitle.trim()) return;
    const reminder: Reminder = {
      id: generateUUID(),
      title: newTitle.trim(),
      amount: newAmount ? parseFloat(newAmount) : undefined,
      category: 'Utilities',
      frequency: newFreq,
      nextDue: computeNextDueDate(newFreq),
      enabled: true,
      createdAt: Date.now(),
    };
    await saveReminder(reminder);
    setNewTitle('');
    setNewAmount('');
    setShowAdd(false);
    load();
  }

  async function handleDelete(r: Reminder) {
    Alert.alert('Delete Reminder', `Remove "${r.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteReminder(r.id); load(); } },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>{'<< BACK'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>REMINDERS</Text>
        <TouchableOpacity onPress={() => setShowAdd(!showAdd)} style={styles.addBtn}>
          <Ionicons name={showAdd ? 'close' : 'add'} size={20} color="#00FF66" />
        </TouchableOpacity>
      </View>

      {showAdd && (
        <View style={styles.addForm}>
          <Text style={styles.formLabel}>TITLE</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Rent, Netflix, Electricity..."
            placeholderTextColor="#555555"
            value={newTitle}
            onChangeText={setNewTitle}
          />
          <Text style={styles.formLabel}>AMOUNT (OPTIONAL)</Text>
          <TextInput
            style={styles.input}
            placeholder="5000"
            placeholderTextColor="#555555"
            value={newAmount}
            onChangeText={setNewAmount}
            keyboardType="numeric"
          />
          <Text style={styles.formLabel}>FREQUENCY</Text>
          <View style={styles.freqRow}>
            {FREQUENCIES.map(f => (
              <TouchableOpacity
                key={f}
                style={[styles.freqChip, newFreq === f && styles.freqChipActive]}
                onPress={() => setNewFreq(f)}
              >
                <Text style={[styles.freqText, newFreq === f && styles.freqTextActive]}>
                  {f.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.confirmBtn} onPress={handleAdd}>
            <Text style={styles.confirmBtnText}>ADD REMINDER</Text>
          </TouchableOpacity>
        </View>
      )}

      {reminders.length === 0 && !showAdd && (
        <View style={styles.empty}>
          <Ionicons name="notifications-off-outline" size={48} color="#333" />
          <Text style={styles.emptyText}>No reminders set</Text>
          <Text style={styles.emptySubtext}>Tap + to add a bill or subscription reminder</Text>
        </View>
      )}

      {reminders.map(r => {
        const dueDate = new Date(r.nextDue);
        const dateStr = dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        return (
          <View key={r.id} style={styles.reminderCard}>
            <View style={styles.reminderHeader}>
              <View style={styles.reminderInfo}>
                <Ionicons name="notifications-outline" size={16} color={r.enabled ? '#FFB000' : '#555555'} />
                <View>
                  <Text style={[styles.reminderTitle, !r.enabled && styles.reminderTitleDisabled]}>{r.title}</Text>
                  {r.amount && (
                    <Text style={styles.reminderAmount}>₹{r.amount.toLocaleString('en-IN')}</Text>
                  )}
                </View>
              </View>
              <View style={styles.reminderActions}>
                <Switch
                  value={r.enabled}
                  onValueChange={async () => { await toggleReminder(r.id); load(); }}
                  trackColor={{ false: '#333333', true: '#004422' }}
                  thumbColor={r.enabled ? '#FFB000' : '#888888'}
                />
                <TouchableOpacity onPress={() => handleDelete(r)}>
                  <Ionicons name="trash-outline" size={16} color="#FF3333" />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.reminderFooter}>
              <Text style={styles.reminderFreq}>{formatFrequency(r.frequency)}</Text>
              <Text style={styles.reminderDue}>Due: {dateStr}</Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  content: { paddingBottom: 32 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? 32 : 16,
    paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#222222',
  },
  backBtn: { padding: 8 },
  backText: { fontFamily: 'monospace', fontSize: 12, color: '#00FF66', letterSpacing: 1 },
  headerTitle: { fontFamily: 'monospace', fontSize: 16, color: '#00FF66', fontWeight: '700', letterSpacing: 2 },
  addBtn: { padding: 8 },
  addForm: {
    margin: 16, backgroundColor: '#0A0A0A', borderRadius: 4,
    padding: 16, borderWidth: 1, borderColor: '#222222', gap: 10,
  },
  formLabel: {
    fontFamily: 'monospace', fontSize: 10, color: '#FFB000', letterSpacing: 1, fontWeight: '700',
  },
  input: {
    fontFamily: 'monospace', fontSize: 14, color: '#E0E0E0', backgroundColor: '#1F1F1F',
    borderRadius: 4, borderWidth: 1, borderColor: '#333333', padding: 12,
  },
  freqRow: { flexDirection: 'row', gap: 8 },
  freqChip: {
    flex: 1, paddingVertical: 8, borderRadius: 4, borderWidth: 1,
    borderColor: '#333333', backgroundColor: '#1F1F1F', alignItems: 'center',
  },
  freqChipActive: { borderColor: '#FFB000', backgroundColor: '#332200' },
  freqText: { fontFamily: 'monospace', fontSize: 10, color: '#888888', letterSpacing: 1 },
  freqTextActive: { color: '#FFB000', fontWeight: '700' },
  confirmBtn: {
    backgroundColor: '#FFB000', borderRadius: 4, padding: 12, alignItems: 'center',
  },
  confirmBtnText: { fontFamily: 'monospace', fontSize: 12, color: '#000000', fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyText: { fontFamily: 'monospace', fontSize: 14, color: '#555555' },
  emptySubtext: { fontFamily: 'monospace', fontSize: 11, color: '#333333' },
  reminderCard: {
    margin: 16, marginBottom: 0, backgroundColor: '#0A0A0A', borderRadius: 4,
    padding: 16, borderWidth: 1, borderColor: '#222222',
  },
  reminderHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  reminderInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  reminderTitle: { fontFamily: 'monospace', fontSize: 13, color: '#E0E0E0', fontWeight: '600' },
  reminderTitleDisabled: { color: '#555555' },
  reminderAmount: { fontFamily: 'monospace', fontSize: 11, color: '#FFB000', marginTop: 2 },
  reminderActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  reminderFooter: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 10,
    paddingTop: 8, borderTopWidth: 1, borderTopColor: '#1A1A1A',
  },
  reminderFreq: { fontFamily: 'monospace', fontSize: 10, color: '#555555' },
  reminderDue: { fontFamily: 'monospace', fontSize: 10, color: '#FFB000' },
});
