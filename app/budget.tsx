import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { BudgetGoal, BudgetStatus, loadBudgetGoals, saveBudgetGoal, deleteBudgetGoal, computeBudgetStatus } from '../src/lib/budget';
import { CATEGORY_CONFIGS, getCategoryConfig } from '../src/constants/categories';
import { generateUUID } from '../src/lib/uuid';

export default function BudgetScreen() {
  const db = useSQLiteContext();
  const [goals, setGoals] = useState<BudgetGoal[]>([]);
  const [statuses, setStatuses] = useState<BudgetStatus[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    const loadedGoals = await loadBudgetGoals();
    setGoals(loadedGoals);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime();
    const expenses = await db.getAllAsync<any>(
      'SELECT * FROM personal_expenses WHERE created_at >= ? AND created_at <= ?',
      [monthStart, monthEnd]
    );
    setStatuses(computeBudgetStatus(loadedGoals, expenses, now.getMonth(), now.getFullYear()));
  }, [db]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (category: string, limit: number) => {
    const goal: BudgetGoal = {
      id: generateUUID(),
      category,
      monthlyLimit: limit,
      currency: 'INR',
      createdAt: Date.now(),
    };
    await saveBudgetGoal(goal);
    setShowAdd(false);
    load();
  };

  const handleDelete = async (id: string) => {
    Alert.alert('Delete Budget', 'Remove this budget goal?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteBudgetGoal(id); load(); } },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>BUDGET GOALS</Text>

      {statuses.length === 0 && (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="target" size={48} color="#333" />
          <Text style={styles.emptyText}>No budget goals set</Text>
          <Text style={styles.emptySubtext}>Tap + to add a monthly spending limit</Text>
        </View>
      )}

      {statuses.map(status => {
        const cat = getCategoryConfig(status.goal.category);
        return (
          <TouchableOpacity
            key={status.goal.id}
            style={styles.goalCard}
            onLongPress={() => handleDelete(status.goal.id)}
          >
            <View style={styles.goalHeader}>
              <MaterialCommunityIcons name={cat.icon as any} size={20} color={cat.color} />
              <Text style={styles.goalLabel}>{cat.label}</Text>
              <Text style={[styles.goalStatus, status.isOverBudget && styles.overBudget]}>
                {status.isOverBudget ? 'OVER BUDGET' : `${status.percentage}%`}
              </Text>
            </View>
            <View style={styles.progressBg}>
              <View style={[
                styles.progressBar,
                {
                  width: `${Math.min(status.percentage, 100)}%`,
                  backgroundColor: status.isOverBudget ? '#FF3333' : status.percentage > 80 ? '#FFAA00' : '#00FF66',
                }
              ]} />
            </View>
            <View style={styles.goalFooter}>
              <Text style={styles.goalSpent}>₹{status.spent.toLocaleString('en-IN')} spent</Text>
              <Text style={styles.goalLimit}>of ₹{status.goal.monthlyLimit.toLocaleString('en-IN')}</Text>
            </View>
          </TouchableOpacity>
        );
      })}

      {showAdd && (
        <AddBudgetPicker
          goals={goals}
          onAdd={handleAdd}
          onCancel={() => setShowAdd(false)}
        />
      )}

      <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(!showAdd)}>
        <MaterialCommunityIcons name={showAdd ? 'close' : 'plus'} size={20} color="#000" />
        <Text style={styles.addBtnText}>{showAdd ? 'CANCEL' : 'ADD BUDGET'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function AddBudgetPicker({ goals, onAdd, onCancel }: {
  goals: BudgetGoal[];
  onAdd: (category: string, limit: number) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<string>('');
  const [limitText, setLimitText] = useState('5000');

  const available = CATEGORY_CONFIGS.filter(c =>
    c.key !== 'pool' && !goals.some(g => g.category.toLowerCase() === c.key)
  );

  return (
    <View style={styles.addForm}>
      <Text style={styles.formTitle}>NEW BUDGET GOAL</Text>
      {available.map(cat => (
        <TouchableOpacity
          key={cat.key}
          style={[styles.catOption, selected === cat.key && styles.catOptionActive]}
          onPress={() => setSelected(cat.key)}
        >
          <MaterialCommunityIcons name={cat.icon as any} size={16} color={selected === cat.key ? '#00FF66' : cat.color} />
          <Text style={[styles.catOptionText, selected === cat.key && styles.catOptionTextActive]}>{cat.label}</Text>
        </TouchableOpacity>
      ))}
      <View style={styles.limitRow}>
        <Text style={styles.limitLabel}>Monthly Limit: ₹</Text>
        <Text style={styles.limitInput}>{limitText}</Text>
      </View>
      <TouchableOpacity
        style={[styles.saveBtn, !selected && styles.saveBtnDisabled]}
        disabled={!selected}
        onPress={() => {
          const limit = parseInt(limitText, 10);
          if (limit > 0 && selected) onAdd(selected, limit);
        }}
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
  goalCard: { backgroundColor: '#111', borderRadius: 8, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#222' },
  goalHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  goalLabel: { color: '#FFF', fontFamily: 'monospace', fontSize: 13, flex: 1 },
  goalStatus: { color: '#00FF66', fontFamily: 'monospace', fontSize: 11, fontWeight: '700' },
  overBudget: { color: '#FF3333' },
  progressBg: { height: 6, backgroundColor: '#222', borderRadius: 3, marginBottom: 8 },
  progressBar: { height: 6, borderRadius: 3 },
  goalFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  goalSpent: { color: '#FFF', fontFamily: 'monospace', fontSize: 11 },
  goalLimit: { color: '#666', fontFamily: 'monospace', fontSize: 11 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#00FF66', paddingVertical: 12, borderRadius: 8, marginTop: 8 },
  addBtnText: { color: '#000', fontFamily: 'monospace', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  addForm: { backgroundColor: '#111', borderRadius: 8, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#333' },
  formTitle: { color: '#00FF66', fontFamily: 'monospace', fontSize: 12, fontWeight: '700', marginBottom: 12, letterSpacing: 1 },
  catOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 6, marginBottom: 4 },
  catOptionActive: { backgroundColor: '#00FF6615', borderWidth: 1, borderColor: '#00FF6630' },
  catOptionText: { color: '#AAA', fontFamily: 'monospace', fontSize: 12 },
  catOptionTextActive: { color: '#00FF66' },
  limitRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  limitLabel: { color: '#AAA', fontFamily: 'monospace', fontSize: 12 },
  limitInput: { color: '#FFF', fontFamily: 'monospace', fontSize: 16, fontWeight: '700' },
  saveBtn: { backgroundColor: '#00FF66', paddingVertical: 10, borderRadius: 6, alignItems: 'center', marginTop: 16 },
  saveBtnDisabled: { opacity: 0.3 },
  saveBtnText: { color: '#000', fontFamily: 'monospace', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
});
