import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RecurringExpense, loadRecurring, saveRecurring, deleteRecurring, createRecurringExpense, isDue, RecurringInterval } from '../src/lib/recurring';
import { getCategoryConfig, CATEGORY_CONFIGS } from '../src/constants/categories';

export default function RecurringScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<RecurringExpense[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setItems(await loadRecurring());
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    Alert.alert('Delete Recurring', 'Remove this recurring expense?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteRecurring(id); load(); } },
    ]);
  };

  const handleToggle = async (item: RecurringExpense) => {
    await saveRecurring({ ...item, enabled: !item.enabled });
    load();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>RECURRING EXPENSES</Text>

      {items.length === 0 && !showAdd && (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="repeat" size={48} color="#333" />
          <Text style={styles.emptyText}>No recurring expenses</Text>
          <Text style={styles.emptySubtext}>Track subscriptions and bills</Text>
        </View>
      )}

      {items.map(item => {
        const cat = getCategoryConfig(item.category);
        const due = isDue(item);
        return (
          <TouchableOpacity
            key={item.id}
            style={[styles.itemCard, due && styles.itemCardDue]}
            onLongPress={() => handleDelete(item.id)}
          >
            <View style={styles.itemHeader}>
              <MaterialCommunityIcons name={cat.icon as any} size={18} color={cat.color} />
              <Text style={styles.itemTitle}>{item.title}</Text>
              <TouchableOpacity onPress={() => handleToggle(item)}>
                <MaterialCommunityIcons
                  name={item.enabled ? 'toggle-switch' : 'toggle-switch-off'}
                  size={28}
                  color={item.enabled ? '#00FF66' : '#444'}
                />
              </TouchableOpacity>
            </View>
            <View style={styles.itemMeta}>
              <Text style={styles.itemAmount}>₹{item.amount.toLocaleString('en-IN')}</Text>
              <Text style={styles.itemInterval}>/{item.interval}</Text>
              {due && <Text style={styles.dueLabel}>DUE NOW</Text>}
            </View>
            <Text style={styles.itemNext}>
              Next: {new Date(item.nextDueDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
            </Text>
          </TouchableOpacity>
        );
      })}

      {showAdd && (
        <AddRecurringPicker
          onAdd={async (title, amount, cat, interval) => {
            const item = createRecurringExpense(title, amount, cat, interval);
            await saveRecurring(item);
            setShowAdd(false);
            load();
          }}
          onCancel={() => setShowAdd(false)}
        />
      )}

      <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(!showAdd)}>
        <MaterialCommunityIcons name={showAdd ? 'close' : 'plus'} size={20} color="#000" />
        <Text style={styles.addBtnText}>{showAdd ? 'CANCEL' : 'ADD RECURRING'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function AddRecurringPicker({ onAdd, onCancel }: {
  onAdd: (title: string, amount: number, category: string, interval: RecurringInterval) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [cat, setCat] = useState('food');
  const [interval, setInterval] = useState<RecurringInterval>('monthly');

  const intervals: { key: RecurringInterval; label: string }[] = [
    { key: 'daily', label: 'DAILY' },
    { key: 'weekly', label: 'WEEKLY' },
    { key: 'monthly', label: 'MONTHLY' },
    { key: 'yearly', label: 'YEARLY' },
  ];

  return (
    <View style={styles.addForm}>
      <Text style={styles.formTitle}>NEW RECURRING</Text>
      <Text style={styles.fieldLabel}>TITLE</Text>
      <Text style={styles.fieldValue}>{title || 'e.g. Netflix, Gym'}</Text>
      <Text style={styles.fieldLabel}>AMOUNT (₹)</Text>
      <Text style={styles.fieldValue}>{amount || '0'}</Text>
      <Text style={styles.fieldLabel}>INTERVAL</Text>
      <View style={styles.intervalRow}>
        {intervals.map(i => (
          <TouchableOpacity
            key={i.key}
            style={[styles.intervalBtn, interval === i.key && styles.intervalBtnActive]}
            onPress={() => setInterval(i.key)}
          >
            <Text style={[styles.intervalText, interval === i.key && styles.intervalTextActive]}>{i.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity
        style={[styles.saveBtn, (!title || !amount) && styles.saveBtnDisabled]}
        disabled={!title || !amount}
        onPress={() => onAdd(title, parseInt(amount, 10), cat, interval)}
      >
        <Text style={styles.saveBtnText}>SAVE</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  content: { padding: 16, paddingBottom: 40 },
  header: { color: '#00FF66', fontSize: 16, fontFamily: 'monospace', fontWeight: '700', letterSpacing: 2, marginBottom: 16 },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: '#FFF', fontFamily: 'monospace', fontSize: 14, marginTop: 12 },
  emptySubtext: { color: '#666', fontFamily: 'monospace', fontSize: 11, marginTop: 4 },
  itemCard: { backgroundColor: '#111', borderRadius: 8, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#222' },
  itemCardDue: { borderColor: '#FFAA00' },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  itemTitle: { color: '#FFF', fontFamily: 'monospace', fontSize: 13, flex: 1, fontWeight: '600' },
  itemMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemAmount: { color: '#00FF66', fontFamily: 'monospace', fontSize: 16, fontWeight: '700' },
  itemInterval: { color: '#666', fontFamily: 'monospace', fontSize: 11 },
  dueLabel: { color: '#FFAA00', fontFamily: 'monospace', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  itemNext: { color: '#666', fontFamily: 'monospace', fontSize: 10, marginTop: 6 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#00FF66', paddingVertical: 12, borderRadius: 8, marginTop: 8 },
  addBtnText: { color: '#000', fontFamily: 'monospace', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  addForm: { backgroundColor: '#111', borderRadius: 8, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#333' },
  formTitle: { color: '#00FF66', fontFamily: 'monospace', fontSize: 12, fontWeight: '700', marginBottom: 12, letterSpacing: 1 },
  fieldLabel: { color: '#666', fontFamily: 'monospace', fontSize: 10, letterSpacing: 1, marginTop: 8, marginBottom: 4 },
  fieldValue: { color: '#FFF', fontFamily: 'monospace', fontSize: 13 },
  intervalRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  intervalBtn: { flex: 1, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: '#333', alignItems: 'center' },
  intervalBtnActive: { borderColor: '#00FF66', backgroundColor: '#00FF6620' },
  intervalText: { color: '#888', fontFamily: 'monospace', fontSize: 10, fontWeight: '600' },
  intervalTextActive: { color: '#00FF66' },
  saveBtn: { backgroundColor: '#00FF66', paddingVertical: 10, borderRadius: 6, alignItems: 'center', marginTop: 16 },
  saveBtnDisabled: { opacity: 0.3 },
  saveBtnText: { color: '#000', fontFamily: 'monospace', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
});
