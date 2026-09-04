import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CATEGORY_CONFIGS } from '../constants/categories';

interface QuickEntryProps {
  visible: boolean;
  onAdd: (title: string, amount: number, category: string) => void;
  onClose: () => void;
}

export function QuickEntry({ visible, onAdd, onClose }: QuickEntryProps) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('food');

  if (!visible) return null;

  function handleConfirm() {
    const amt = parseFloat(amount);
    if (!title.trim() || isNaN(amt) || amt <= 0) return;
    onAdd(title.trim(), amt, category);
    setTitle('');
    setAmount('');
    setCategory('food');
    onClose();
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>QUICK ENTRY</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={18} color="#888888" />
        </TouchableOpacity>
      </View>

      <View style={styles.row}>
        <TextInput
          style={[styles.input, styles.titleInput]}
          placeholder="What was it?"
          placeholderTextColor="#555555"
          value={title}
          onChangeText={setTitle}
          autoFocus
          maxLength={50}
        />
        <TextInput
          style={[styles.input, styles.amountInput]}
          placeholder="₹0"
          placeholderTextColor="#555555"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          maxLength={10}
        />
      </View>

      <View style={styles.categoryRow}>
        {CATEGORY_CONFIGS.slice(0, 6).map(c => (
          <TouchableOpacity
            key={c.key}
            style={[styles.catChip, category === c.key && styles.catChipActive]}
            onPress={() => setCategory(c.key)}
          >
            <Ionicons name={c.icon as any} size={14} color={category === c.key ? c.color : '#555555'} />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.confirmBtn, (!title.trim() || !amount) && styles.confirmBtnDisabled]}
        onPress={handleConfirm}
        disabled={!title.trim() || !amount}
      >
        <Ionicons name="checkmark" size={18} color="#000000" />
        <Text style={styles.confirmText}>ADD</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0A0A0A',
    borderTopWidth: 1,
    borderTopColor: '#222222',
    padding: 12,
    paddingBottom: Platform.OS === 'android' ? 16 : 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerText: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#FFB000',
    letterSpacing: 1,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    fontFamily: 'monospace',
    fontSize: 14,
    color: '#E0E0E0',
    backgroundColor: '#1F1F1F',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#333333',
    padding: 10,
  },
  titleInput: { flex: 2 },
  amountInput: { flex: 1 },
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  catChip: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1F1F1F',
    borderWidth: 1,
    borderColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  catChipActive: {
    borderColor: '#00FF66',
    backgroundColor: '#003311',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#00FF66',
    borderRadius: 4,
    paddingVertical: 10,
    marginTop: 10,
  },
  confirmBtnDisabled: {
    opacity: 0.3,
  },
  confirmText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#000000',
    fontWeight: '700',
    letterSpacing: 1,
  },
});
