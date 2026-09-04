import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
  ScrollView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SavingsGoal, loadGoals, saveGoal, deleteGoal, addToGoal, computeGoalProgress, pickGoalColor } from '../src/lib/goals';
import { generateUUID } from '../src/lib/uuid';

export default function GoalsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [selectedColor, setSelectedColor] = useState(pickGoalColor(0));

  const load = useCallback(async () => {
    const g = await loadGoals();
    setGoals(g);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAddGoal() {
    if (!newName.trim() || !newTarget) return;
    const target = parseFloat(newTarget);
    if (isNaN(target) || target <= 0) {
      Alert.alert('Invalid', 'Enter a valid target amount.');
      return;
    }
    const goal: SavingsGoal = {
      id: generateUUID(),
      name: newName.trim(),
      targetAmount: target,
      currentAmount: 0,
      currency: 'INR',
      createdAt: Date.now(),
      color: selectedColor,
    };
    await saveGoal(goal);
    setNewName('');
    setNewTarget('');
    setShowAdd(false);
    load();
  }

  async function handleDeleteGoal(goal: SavingsGoal) {
    Alert.alert('Delete Goal', `Remove "${goal.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteGoal(goal.id); load(); } },
    ]);
  }

  async function handleAddAmount(goal: SavingsGoal) {
    Alert.prompt?.(
      `Add to "${goal.name}"`,
      'Enter amount to add:',
      async (text: string) => {
        const amt = parseFloat(text);
        if (!isNaN(amt) && amt > 0) {
          await addToGoal(goal.id, amt);
          load();
        }
      },
      'plain-text',
      '',
      'number-pad'
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>{'<< BACK'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SAVINGS GOALS</Text>
        <TouchableOpacity onPress={() => setShowAdd(!showAdd)} style={styles.addBtn}>
          <Ionicons name={showAdd ? 'close' : 'add'} size={20} color="#00FF66" />
        </TouchableOpacity>
      </View>

      {/* Add Goal Form */}
      {showAdd && (
        <View style={styles.addForm}>
          <Text style={styles.formLabel}>GOAL NAME</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Trip Fund, Emergency..."
            placeholderTextColor="#555555"
            value={newName}
            onChangeText={setNewName}
            maxLength={40}
          />
          <Text style={styles.formLabel}>TARGET AMOUNT</Text>
          <TextInput
            style={styles.input}
            placeholder="10000"
            placeholderTextColor="#555555"
            value={newTarget}
            onChangeText={setNewTarget}
            keyboardType="numeric"
          />
          <Text style={styles.formLabel}>COLOR</Text>
          <View style={styles.colorRow}>
            {[pickGoalColor(0), pickGoalColor(1), pickGoalColor(2), pickGoalColor(3), pickGoalColor(4)].map((c, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.colorDot, { backgroundColor: c }, selectedColor === c && styles.colorDotActive]}
                onPress={() => setSelectedColor(c)}
              />
            ))}
          </View>
          <TouchableOpacity style={styles.confirmBtn} onPress={handleAddGoal}>
            <Text style={styles.confirmBtnText}>CREATE GOAL</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Goals List */}
      {goals.length === 0 && !showAdd && (
        <View style={styles.empty}>
          <Ionicons name="flag-outline" size={48} color="#333" />
          <Text style={styles.emptyText}>No savings goals yet</Text>
          <Text style={styles.emptySubtext}>Tap + to set your first goal</Text>
        </View>
      )}

      {goals.map(goal => {
        const progress = computeGoalProgress(goal);
        return (
          <View key={goal.id} style={[styles.goalCard, { borderLeftColor: goal.color }]}>
            <View style={styles.goalHeader}>
              <Text style={styles.goalName}>{goal.name}</Text>
              <TouchableOpacity onPress={() => handleDeleteGoal(goal)}>
                <Ionicons name="trash-outline" size={16} color="#FF3333" />
              </TouchableOpacity>
            </View>
            <Text style={styles.goalAmount}>
              ₹{goal.currentAmount.toLocaleString('en-IN')} / ₹{goal.targetAmount.toLocaleString('en-IN')}
            </Text>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progress.percentage}%`, backgroundColor: goal.color }]} />
            </View>
            <View style={styles.goalFooter}>
              <Text style={styles.goalPercent}>{progress.percentage}%</Text>
              {progress.daysLeft !== undefined && (
                <Text style={styles.goalDeadline}>{progress.daysLeft} days left</Text>
              )}
              {progress.isComplete && (
                <Text style={[styles.goalDeadline, { color: '#00FF66' }]}>✓ Complete!</Text>
              )}
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
  colorRow: { flexDirection: 'row', gap: 12 },
  colorDot: { width: 28, height: 28, borderRadius: 14 },
  colorDotActive: { borderWidth: 2, borderColor: '#FFFFFF' },
  confirmBtn: {
    backgroundColor: '#00FF66', borderRadius: 4, padding: 12, alignItems: 'center',
  },
  confirmBtnText: { fontFamily: 'monospace', fontSize: 12, color: '#000000', fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyText: { fontFamily: 'monospace', fontSize: 14, color: '#555555' },
  emptySubtext: { fontFamily: 'monospace', fontSize: 11, color: '#333333' },
  goalCard: {
    margin: 16, marginBottom: 0, backgroundColor: '#0A0A0A', borderRadius: 4,
    padding: 16, borderWidth: 1, borderColor: '#222222', borderLeftWidth: 4,
  },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  goalName: { fontFamily: 'monospace', fontSize: 14, color: '#E0E0E0', fontWeight: '700' },
  goalAmount: { fontFamily: 'monospace', fontSize: 13, color: '#888888', marginBottom: 8 },
  progressBarBg: {
    height: 8, backgroundColor: '#1F1F1F', borderRadius: 4, overflow: 'hidden',
  },
  progressBarFill: { height: 8, borderRadius: 4 },
  goalFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  goalPercent: { fontFamily: 'monospace', fontSize: 11, color: '#555555' },
  goalDeadline: { fontFamily: 'monospace', fontSize: 11, color: '#FFB000' },
});
