import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ActiveMode } from '../context/LedgerContext';

interface DockProps {
  mode: ActiveMode;
  onModeSwitch: () => void;
  onVoicePress: () => void;
  isRecording: boolean;
}

export function Dock({ mode, onModeSwitch, onVoicePress, isRecording }: DockProps) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Top row: Feature nav */}
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.navBtn} onPress={() => router.push('/stats')}>
          <Text style={styles.navBtnText}>[📊 STATS]</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={() => router.push('/budget')}>
          <Text style={styles.navBtnText}>[🎯 BUDGET]</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={() => router.push('/search')}>
          <Text style={styles.navBtnText}>[🔍 FIND]</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={() => router.push('/recurring')}>
          <Text style={styles.navBtnText}>[🔄 REPEAT]</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom row: Core nav */}
      <View style={styles.bottomRow}>
        <TouchableOpacity style={styles.navBtn} onPress={onModeSwitch}>
          <Text style={styles.navBtnText}>
            {mode === 'PERSONAL' ? '[/personal]' : '[/trips]'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.voiceBtn} onPress={onVoicePress}>
          <Text style={[styles.voiceBtnText, isRecording && styles.voiceBtnActive]}>
            {isRecording ? '( ( ( ● REC ) ) )' : '( ( ( ○ ) ) )'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navBtn} onPress={() => router.push('/settings')}>
          <Text style={styles.navBtnText}>[⚙ SET]</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: '#222',
    backgroundColor: '#0A0A0A',
    paddingBottom: Platform.OS === 'android' ? 12 : 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  navBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  navBtnText: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#888',
    letterSpacing: 0.5,
  },
  voiceBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  voiceBtnText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#888',
  },
  voiceBtnActive: {
    color: '#FF3333',
  },
});
