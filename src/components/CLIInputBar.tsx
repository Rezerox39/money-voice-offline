import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface CLIInputBarProps {
  visible: boolean;
  onSubmit: (text: string) => void;
  onClose: () => void;
}

export function CLIInputBar({ visible, onSubmit, onClose }: CLIInputBarProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);

  if (!visible) return null;

  function handleSubmit() {
    if (!text.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSubmit(text.trim());
    setText('');
    onClose();
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.promptText}>{'>'} Enter command:</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="close" size={16} color="#888888" />
        </TouchableOpacity>
      </View>
      <View style={styles.inputRow}>
        <Text style={styles.chevron}>{'>'}</Text>
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder='e.g. "Dinner 1200 split with all"'
          placeholderTextColor="#333333"
          value={text}
          onChangeText={setText}
          onSubmitEditing={handleSubmit}
          autoFocus
          returnKeyType="send"
          selectionColor="#00FF66"
        />
        <TouchableOpacity style={styles.sendBtn} onPress={handleSubmit}>
          <Ionicons name="arrow-forward" size={16} color="#000000" />
        </TouchableOpacity>
      </View>
      <Text style={styles.hintText}>
        "Chai 30" • "Dinner 1200 split with all" • "Who owes what"
      </Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0A0A0A',
    borderTopWidth: 1,
    borderTopColor: '#00FF66',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  promptText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#00FF66',
    letterSpacing: 1,
    fontWeight: '700',
  },
  closeBtn: { padding: 4 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111111',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#333333',
    paddingHorizontal: 10,
    height: 44,
  },
  chevron: {
    fontFamily: 'monospace',
    fontSize: 14,
    color: '#00FF66',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontFamily: 'monospace',
    fontSize: 14,
    color: '#E0E0E0',
    padding: 0,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#00FF66',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  hintText: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#333333',
    marginTop: 6,
  },
});
