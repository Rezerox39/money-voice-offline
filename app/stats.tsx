import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { computePersonalStats, getDailyBreakdown, CategoryStat } from '../src/lib/stats';
import { getCategoryConfig } from '../src/constants/categories';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function StatsScreen() {
  const db = useSQLiteContext();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [period, setPeriod] = useState<'week' | 'month' | 'year' | 'all'>('month');

  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async () => {
    const rows = await db.getAllAsync<any>('SELECT * FROM personal_expenses ORDER BY created_at DESC');
    setExpenses(rows);
  };

  const timeRange = useMemo(() => {
    const now = Date.now();
    switch (period) {
      case 'week': return { start: now - 7 * 24 * 60 * 60 * 1000, end: now };
      case 'month': {
        const d = new Date();
        d.setDate(1); d.setHours(0, 0, 0, 0);
        return { start: d.getTime(), end: now };
      }
      case 'year': {
        const d = new Date();
        d.setMonth(0, 1); d.setHours(0, 0, 0, 0);
        return { start: d.getTime(), end: now };
      }
      default: return { start: 0, end: now };
    }
  }, [period]);

  const stats = useMemo(() => {
    return computePersonalStats(expenses, timeRange.start, timeRange.end);
  }, [expenses, timeRange]);

  const daily = useMemo(() => getDailyBreakdown(expenses), [expenses]);

  const periods = [
    { key: 'week' as const, label: '7D' },
    { key: 'month' as const, label: '30D' },
    { key: 'year' as const, label: '1Y' },
    { key: 'all' as const, label: 'ALL' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>STATISTICS</Text>

      {/* Period Selector */}
      <View style={styles.periodRow}>
        {periods.map(p => (
          <TouchableOpacity
            key={p.key}
            style={[styles.periodBtn, period === p.key && styles.periodBtnActive]}
            onPress={() => setPeriod(p.key)}
          >
            <Text style={[styles.periodText, period === p.key && styles.periodTextActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Summary Cards */}
      <View style={styles.cardRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>TOTAL</Text>
          <Text style={styles.summaryValue}>₹{stats.total.toLocaleString('en-IN')}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>TRANSACTIONS</Text>
          <Text style={styles.summaryValue}>{stats.count}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>AVERAGE</Text>
          <Text style={styles.summaryValue}>₹{stats.average.toLocaleString('en-IN')}</Text>
        </View>
      </View>

      {/* Category Breakdown */}
      <Text style={styles.sectionTitle}>BREAKDOWN BY CATEGORY</Text>
      {stats.categories.map((cat) => (
        <CategoryBar key={cat.category} stat={cat} maxAmount={stats.categories[0]?.total || 1} />
      ))}

      {stats.categories.length === 0 && (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="chart-pie" size={48} color="#333" />
          <Text style={styles.emptyText}>No expenses in this period</Text>
        </View>
      )}
    </ScrollView>
  );
}

function CategoryBar({ stat, maxAmount }: { stat: CategoryStat; maxAmount: number }) {
  const barWidth = (stat.total / maxAmount) * (SCREEN_WIDTH - 80);
  return (
    <View style={styles.catRow}>
      <View style={styles.catInfo}>
        <MaterialCommunityIcons name={stat.icon as any} size={18} color={stat.color} />
        <Text style={styles.catLabel}>{stat.label}</Text>
      </View>
      <View style={styles.catBarContainer}>
        <View style={[styles.catBar, { width: Math.max(barWidth, 4), backgroundColor: stat.color }]} />
      </View>
      <Text style={styles.catAmount}>₹{stat.total.toLocaleString('en-IN')}</Text>
      <Text style={styles.catPercent}>{stat.percentage}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  content: { padding: 16, paddingBottom: 40 },
  header: { color: '#00FF66', fontSize: 16, fontFamily: 'monospace', fontWeight: '700', letterSpacing: 2, marginBottom: 16 },
  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  periodBtn: { flex: 1, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: '#333', alignItems: 'center' },
  periodBtnActive: { borderColor: '#00FF66', backgroundColor: '#00FF6620' },
  periodText: { color: '#666', fontFamily: 'monospace', fontSize: 12, fontWeight: '600' },
  periodTextActive: { color: '#00FF66' },
  cardRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  summaryCard: { flex: 1, backgroundColor: '#111', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#222' },
  summaryLabel: { color: '#666', fontFamily: 'monospace', fontSize: 9, letterSpacing: 1, marginBottom: 4 },
  summaryValue: { color: '#FFF', fontFamily: 'monospace', fontSize: 16, fontWeight: '700' },
  sectionTitle: { color: '#888', fontFamily: 'monospace', fontSize: 11, letterSpacing: 2, marginBottom: 12 },
  catRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  catInfo: { flexDirection: 'row', alignItems: 'center', width: 120, gap: 8 },
  catLabel: { color: '#CCC', fontFamily: 'monospace', fontSize: 11 },
  catBarContainer: { flex: 1, height: 6, backgroundColor: '#222', borderRadius: 3, marginHorizontal: 8 },
  catBar: { height: 6, borderRadius: 3 },
  catAmount: { color: '#FFF', fontFamily: 'monospace', fontSize: 11, width: 60, textAlign: 'right' },
  catPercent: { color: '#666', fontFamily: 'monospace', fontSize: 10, width: 40, textAlign: 'right' },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: '#666', fontFamily: 'monospace', fontSize: 12, marginTop: 12 },
});
