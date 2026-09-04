import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BudgetGoal, BudgetStatus, loadBudgetGoals, saveBudgetGoal,
  deleteBudgetGoal, computeBudgetStatus,
} from '../src/lib/budget';
import { CATEGORY_CONFIGS, getCategoryConfig } from '../src/constants/categories';
import { generateUUID } from '../src/lib/uuid';
import { ParticleField } from '../src/components/ParticleField';

type BudgetTab = 'overview' | 'recurring' | 'goals';

export default function BudgetScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useSQLiteContext();
  const [activeTab, setActiveTab] = useState<BudgetTab>('overview');
  const [goals, setGoals] = useState<BudgetGoal[]>([]);
  const [statuses, setStatuses] = useState<BudgetStatus[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    try {
      const loadedGoals = await loadBudgetGoals();
      setGoals(Array.isArray(loadedGoals) ? loadedGoals : []);
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime();
      const expenses = await db.getAllAsync<any>(
        'SELECT * FROM personal_expenses WHERE created_at >= ? AND created_at <= ?',
        [monthStart, monthEnd]
      );
      setStatuses(computeBudgetStatus(loadedGoals, Array.isArray(expenses) ? expenses : [], now.getMonth(), now.getFullYear()));
    } catch (err) {
      console.warn('[DB_RECOVERY] budget load failed:', err);
      setGoals([]);
      setStatuses([]);
    }
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

  function handleTabSwitch(tab: BudgetTab) {
    Haptics.selectionAsync();
    setActiveTab(tab);
  }

  return (
    <View style={styles.container}>
      <ParticleField active={true} count={14} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 24) }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>{'<<'}</Text>
        </TouchableOpacity>
        <Text style={styles.header}>[$ BUDGET]</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Segmented Switch */}
      <View style={styles.segmentBar}>
        {([
          { key: 'overview' as BudgetTab, label: '[ OVERVIEW ]' },
          { key: 'recurring' as BudgetTab, label: '[ RECURRING ]' },
          { key: 'goals' as BudgetTab, label: '[ GOALS ]' },
        ]).map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.segmentBtn, activeTab === tab.key && styles.segmentBtnActive]}
            onPress={() => handleTabSwitch(tab.key)}
          >
            <Text style={[styles.segmentText, activeTab === tab.key && styles.segmentTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
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
            <AddBudgetPicker goals={goals} onAdd={handleAdd} onCancel={() => setShowAdd(false)} />
          )}

          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(!showAdd)}>
            <MaterialCommunityIcons name={showAdd ? 'close' : 'plus'} size={20} color="#000" />
            <Text style={styles.addBtnText}>{showAdd ? 'CANCEL' : 'ADD BUDGET'}</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Recurring Tab */}
      {activeTab === 'recurring' && (
        <TouchableOpacity style={styles.navCard} onPress={() => router.push('/recurring')}>
          <Ionicons name="repeat-outline" size={24} color="#00FF66" />
          <View style={styles.navCardInfo}>
            <Text style={styles.navCardTitle}>RECURRING EXPENSES</Text>
            <Text style={styles.navCardDesc}>Manage subscriptions, bills & repeat payments</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#555555" />
        </TouchableOpacity>
      )}

      {/* Goals Tab */}
      {activeTab === 'goals' && (
        <TouchableOpacity style={styles.navCard} onPress={() => router.push('/goals')}>
          <Ionicons name="flag-outline" size={24} color="#FFB000" />
          <View style={styles.navCardInfo}>
            <Text style={styles.navCardTitle}>SAVINGS GOALS</Text>
            <Text style={styles.navCardDesc}>Track progress toward financial targets</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#555555" />
        </TouchableOpacity>
      )}
    </ScrollView>
    </View>
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
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  backBtn: { padding: 4 },
  backText: { fontFamily: 'monospace', fontSize: 12, color: '#00FF66', letterSpacing: 1 },
  header: { fontFamily: 'monospace', fontSize: 16, color: '#00FF66', fontWeight: '700', letterSpacing: 2 },
  segmentBar: {
    flexDirection: 'row', backgroundColor: '#0A0A0A', borderRadius: 4, borderWidth: 1,
    borderColor: '#222222', marginBottom: 16, overflow: 'hidden',
  },
  segmentBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  segmentBtnActive: { borderBottomColor: '#00FF66', backgroundColor: '#0A0A0A' },
  segmentText: { fontFamily: 'monospace', fontSize: 10, color: '#555555', letterSpacing: 0.5 },
  segmentTextActive: { color: '#00FF66', fontWeight: '700' },
  navCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#0A0A0A', borderRadius: 4, padding: 16,
    borderWidth: 1, borderColor: '#222222',
  },
  navCardInfo: { flex: 1 },
  navCardTitle: { fontFamily: 'monospace', fontSize: 13, color: '#E0E0E0', fontWeight: '700' },
  navCardDesc: { fontFamily: 'monospace', fontSize: 10, color: '#555555', marginTop: 4 },
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
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#00FF66', paddingVertical: 12, borderRadius: 8, marginTop: 8,
  },
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
