import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { matchesFilters, SearchFilters } from '../src/lib/search';
import { getCategoryConfig } from '../src/constants/categories';

interface ExpenseRow {
  id: string;
  title: string;
  amount: number;
  category: string;
  created_at: number;
  source: 'personal' | 'trip';
}

export default function SearchScreen() {
  const db = useSQLiteContext();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ExpenseRow[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();

  const search = useCallback(async (q: string, cat?: string) => {
    if (!q.trim() && !cat) { setResults([]); return; }

    const personal = await db.getAllAsync<any>('SELECT * FROM personal_expenses');
    const trips = await db.getAllAsync<any>('SELECT * FROM expenses');

    const all: ExpenseRow[] = [
      ...personal.map((e: any) => ({ ...e, source: 'personal' as const })),
      ...trips.map((e: any) => ({ ...e, source: 'trip' as const, created_at: e.updated_at })),
    ];

    const filters: SearchFilters = {
      query: q,
      category: cat,
    };

    setResults(matchesFilters(all, filters));
  }, [db]);

  const handleQuery = (text: string) => {
    setQuery(text);
    search(text, selectedCategory);
  };

  const handleCategory = (cat?: string) => {
    setSelectedCategory(cat);
    search(query, cat);
  };

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchBar}>
        <MaterialCommunityIcons name="magnify" size={18} color="#666" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search expenses..."
          placeholderTextColor="#555"
          value={query}
          onChangeText={handleQuery}
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => handleQuery('')}>
            <MaterialCommunityIcons name="close-circle" size={16} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      {/* Category Filter */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, !selectedCategory && styles.filterChipActive]}
          onPress={() => handleCategory(undefined)}
        >
          <Text style={[styles.filterText, !selectedCategory && styles.filterTextActive]}>ALL</Text>
        </TouchableOpacity>
        {['food', 'transport', 'shopping', 'entertainment', 'other'].map(cat => {
          const config = getCategoryConfig(cat);
          return (
            <TouchableOpacity
              key={cat}
              style={[styles.filterChip, selectedCategory === cat && styles.filterChipActive]}
              onPress={() => handleCategory(cat)}
            >
              <MaterialCommunityIcons name={config.icon as any} size={12} color={selectedCategory === cat ? '#000' : config.color} />
              <Text style={[styles.filterText, selectedCategory === cat && styles.filterTextActive]}>{config.label.split(' ')[0]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Results */}
      <FlatList
        data={results}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          query.length > 0 ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="magnify-close" size={36} color="#333" />
              <Text style={styles.emptyText}>No results for "{query}"</Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="magnify" size={36} color="#333" />
              <Text style={styles.emptyText}>Type to search all expenses</Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const cat = getCategoryConfig(item.category);
          const date = new Date(item.created_at);
          return (
            <View style={styles.resultRow}>
              <View style={[styles.resultIcon, { backgroundColor: cat.color + '20' }]}>
                <MaterialCommunityIcons name={cat.icon as any} size={18} color={cat.color} />
              </View>
              <View style={styles.resultInfo}>
                <Text style={styles.resultTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.resultMeta}>
                  {cat.label} • {date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                  {item.source === 'trip' ? ' • 🏖️ Trip' : ''}
                </Text>
              </View>
              <Text style={styles.resultAmount}>₹{item.amount.toLocaleString('en-IN')}</Text>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', margin: 16, marginBottom: 8, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#222', gap: 8 },
  searchInput: { flex: 1, color: '#FFF', fontFamily: 'monospace', fontSize: 14 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 12, gap: 6, flexWrap: 'wrap' },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: '#333', backgroundColor: '#111' },
  filterChipActive: { borderColor: '#00FF66', backgroundColor: '#00FF66' },
  filterText: { color: '#888', fontFamily: 'monospace', fontSize: 10, fontWeight: '600' },
  filterTextActive: { color: '#000' },
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1A1A1A', gap: 12 },
  resultIcon: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  resultInfo: { flex: 1 },
  resultTitle: { color: '#FFF', fontFamily: 'monospace', fontSize: 13, fontWeight: '600' },
  resultMeta: { color: '#666', fontFamily: 'monospace', fontSize: 10, marginTop: 2 },
  resultAmount: { color: '#00FF66', fontFamily: 'monospace', fontSize: 13, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: '#555', fontFamily: 'monospace', fontSize: 12, marginTop: 12 },
});
