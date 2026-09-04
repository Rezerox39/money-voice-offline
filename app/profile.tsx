import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
  ScrollView, Platform, Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getProfile, saveProfile, setPinCode, UserProfile } from '../src/lib/profile';
import { getStreakData, formatStreak, StreakData } from '../src/lib/streak';
import { CURRENCIES } from '../src/types';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [editName, setEditName] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [showPinSetup, setShowPinSetup] = useState(false);

  const load = useCallback(async () => {
    const p = await getProfile();
    setProfile(p);
    setEditName(p.name);
    const s = await getStreakData();
    setStreak(s);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSaveName() {
    if (!editName.trim()) return;
    const updated = await saveProfile({ name: editName.trim() });
    setProfile(updated);
    setIsEditing(false);
    Alert.alert('Updated', 'Profile name saved.');
  }

  async function handleToggleNotifications(val: boolean) {
    const updated = await saveProfile({ notificationsEnabled: val });
    setProfile(updated);
  }

  async function handleToggleWeeklyReport(val: boolean) {
    const updated = await saveProfile({ weeklyReportEnabled: val });
    setProfile(updated);
  }

  async function handleSetPin() {
    if (pinInput.length < 4 || pinInput.length > 6) {
      Alert.alert('Invalid PIN', 'PIN must be 4-6 digits.');
      return;
    }
    await setPinCode(pinInput);
    setPinInput('');
    setShowPinSetup(false);
    load();
    Alert.alert('PIN Set', 'App will require PIN on next launch.');
  }

  async function handleRemovePin() {
    Alert.alert('Remove PIN', 'This will remove the PIN lock.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          await setPinCode(undefined);
          load();
        },
      },
    ]);
  }

  if (!profile) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 24) }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>{'<< BACK'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>PROFILE</Text>
        <View style={{ width: 48 }} />
      </View>

      {/* Avatar & Name */}
      <View style={styles.card}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{profile.name.charAt(0).toUpperCase()}</Text>
        </View>
        {isEditing ? (
          <View style={styles.editRow}>
            <TextInput
              style={styles.nameInput}
              value={editName}
              onChangeText={setEditName}
              autoFocus
              maxLength={30}
            />
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveName}>
              <Text style={styles.saveBtnText}>SAVE</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setIsEditing(true)}>
            <Text style={styles.profileName}>{profile.name}</Text>
            <Text style={styles.profileEditHint}>Tap to edit</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Streak */}
      {streak && (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>STREAK</Text>
          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{streak.currentStreak}</Text>
              <Text style={styles.statLabel}>Current</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#FFB000' }]}>{streak.longestStreak}</Text>
              <Text style={styles.statLabel}>Best</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#3366FF' }]}>{streak.totalDaysLogged}</Text>
              <Text style={styles.statLabel}>Total Days</Text>
            </View>
          </View>
          <Text style={styles.streakText}>{formatStreak(streak)}</Text>
        </View>
      )}

      {/* Currency */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>DEFAULT CURRENCY</Text>
        <View style={styles.currencyGrid}>
          {Object.entries(CURRENCIES).map(([code, info]) => (
            <TouchableOpacity
              key={code}
              style={[styles.currencyBtn, profile.defaultCurrency === code && styles.currencyBtnActive]}
              onPress={async () => {
                const updated = await saveProfile({ defaultCurrency: code });
                setProfile(updated);
              }}
            >
              <Text style={[styles.currencyBtnText, profile.defaultCurrency === code && styles.currencyBtnTextActive]}>
                {info.symbol} {code}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Notifications */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>PREFERENCES</Text>
        <View style={styles.toggleRow}>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleLabel}>Reminders</Text>
            <Text style={styles.toggleHint}>Bill & budget notifications</Text>
          </View>
          <Switch
            value={profile.notificationsEnabled}
            onValueChange={handleToggleNotifications}
            trackColor={{ false: '#333333', true: '#004422' }}
            thumbColor={profile.notificationsEnabled ? '#00FF66' : '#888888'}
          />
        </View>
        <View style={styles.toggleRow}>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleLabel}>Weekly Report</Text>
            <Text style={styles.toggleHint}>Summary of your spending</Text>
          </View>
          <Switch
            value={profile.weeklyReportEnabled}
            onValueChange={handleToggleWeeklyReport}
            trackColor={{ false: '#333333', true: '#004422' }}
            thumbColor={profile.weeklyReportEnabled ? '#00FF66' : '#888888'}
          />
        </View>
      </View>

      {/* Security */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>SECURITY</Text>
        {profile.pinCode ? (
          <View>
            <View style={styles.pinStatus}>
              <Ionicons name="lock-closed" size={16} color="#00FF66" />
              <Text style={styles.pinStatusText}>PIN Lock Active</Text>
            </View>
            <TouchableOpacity style={styles.dangerBtn} onPress={handleRemovePin}>
              <Text style={styles.dangerBtnText}>REMOVE PIN</Text>
            </TouchableOpacity>
          </View>
        ) : showPinSetup ? (
          <View style={styles.pinSetup}>
            <TextInput
              style={styles.pinInput}
              placeholder="Enter 4-6 digit PIN"
              placeholderTextColor="#555555"
              value={pinInput}
              onChangeText={setPinInput}
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry
            />
            <View style={styles.pinActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowPinSetup(false); setPinInput(''); }}>
                <Text style={styles.cancelBtnText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleSetPin}>
                <Text style={styles.confirmBtnText}>SET PIN</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.enablePinBtn} onPress={() => setShowPinSetup(true)}>
            <Ionicons name="lock-open-outline" size={16} color="#FFB000" />
            <Text style={styles.enablePinText}>ENABLE PIN LOCK</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* System Info */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>SYSTEM</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoKey}>VERSION</Text>
          <Text style={styles.infoVal}>1.0.0-offline</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoKey}>ENGINE</Text>
          <Text style={styles.infoVal}>LOCAL ONLY</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoKey}>CLOUD</Text>
          <Text style={[styles.infoVal, { color: '#FF3333' }]}>DISABLED</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoKey}>DATA</Text>
          <Text style={styles.infoVal}>ON-DEVICE ONLY</Text>
        </View>
      </View>
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
  card: {
    margin: 16, marginBottom: 0, backgroundColor: '#0A0A0A', borderRadius: 4,
    padding: 16, borderWidth: 1, borderColor: '#222222',
  },
  sectionLabel: {
    fontFamily: 'monospace', fontSize: 11, color: '#FFB000', letterSpacing: 1,
    fontWeight: '700', marginBottom: 12,
  },
  avatarCircle: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#1F1F1F',
    borderWidth: 2, borderColor: '#00FF66', justifyContent: 'center', alignItems: 'center',
    alignSelf: 'center', marginBottom: 12,
  },
  avatarText: {
    fontFamily: 'monospace', fontSize: 24, color: '#00FF66', fontWeight: '700',
  },
  profileName: {
    fontFamily: 'monospace', fontSize: 18, color: '#E0E0E0', fontWeight: '700',
    textAlign: 'center',
  },
  profileEditHint: {
    fontFamily: 'monospace', fontSize: 11, color: '#555555', textAlign: 'center', marginTop: 4,
  },
  editRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  nameInput: {
    flex: 1, fontFamily: 'monospace', fontSize: 14, color: '#E0E0E0',
    backgroundColor: '#1F1F1F', borderRadius: 4, borderWidth: 1, borderColor: '#333333',
    padding: 8,
  },
  saveBtn: {
    backgroundColor: '#00FF66', borderRadius: 4, paddingVertical: 8, paddingHorizontal: 16,
  },
  saveBtnText: { fontFamily: 'monospace', fontSize: 11, color: '#000000', fontWeight: '700' },
  statRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8 },
  statItem: { alignItems: 'center', gap: 4 },
  statValue: { fontFamily: 'monospace', fontSize: 22, color: '#00FF66', fontWeight: '700' },
  statLabel: { fontFamily: 'monospace', fontSize: 10, color: '#555555' },
  streakText: { fontFamily: 'monospace', fontSize: 12, color: '#888888', textAlign: 'center' },
  currencyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  currencyBtn: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 4,
    borderWidth: 1, borderColor: '#333333', backgroundColor: '#1F1F1F',
  },
  currencyBtnActive: { borderColor: '#00FF66', backgroundColor: '#003311' },
  currencyBtnText: { fontFamily: 'monospace', fontSize: 12, color: '#888888' },
  currencyBtnTextActive: { color: '#00FF66', fontWeight: '700' },
  toggleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1A1A1A',
  },
  toggleInfo: { flex: 1 },
  toggleLabel: { fontFamily: 'monospace', fontSize: 13, color: '#E0E0E0' },
  toggleHint: { fontFamily: 'monospace', fontSize: 10, color: '#555555', marginTop: 2 },
  pinStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  pinStatusText: { fontFamily: 'monospace', fontSize: 13, color: '#00FF66' },
  enablePinBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12,
    backgroundColor: '#1F1F1F', borderRadius: 4, borderWidth: 1, borderColor: '#333333',
  },
  enablePinText: { fontFamily: 'monospace', fontSize: 12, color: '#FFB000', fontWeight: '700' },
  dangerBtn: {
    backgroundColor: '#1A0000', borderRadius: 4, padding: 12,
    borderWidth: 1, borderColor: '#FF3333', alignItems: 'center',
  },
  dangerBtnText: { fontFamily: 'monospace', fontSize: 12, color: '#FF3333', fontWeight: '700' },
  pinSetup: { gap: 12 },
  pinInput: {
    fontFamily: 'monospace', fontSize: 14, color: '#E0E0E0', letterSpacing: 8,
    backgroundColor: '#1F1F1F', borderRadius: 4, borderWidth: 1, borderColor: '#333333',
    padding: 12, textAlign: 'center',
  },
  pinActions: { flexDirection: 'row', gap: 8 },
  cancelBtn: {
    flex: 1, backgroundColor: '#1F1F1F', borderRadius: 4, padding: 12,
    borderWidth: 1, borderColor: '#333333', alignItems: 'center',
  },
  cancelBtnText: { fontFamily: 'monospace', fontSize: 11, color: '#888888', fontWeight: '700' },
  confirmBtn: {
    flex: 1, backgroundColor: '#003311', borderRadius: 4, padding: 12,
    borderWidth: 1, borderColor: '#00FF66', alignItems: 'center',
  },
  confirmBtnText: { fontFamily: 'monospace', fontSize: 11, color: '#00FF66', fontWeight: '700' },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#1A1A1A',
  },
  infoKey: { fontFamily: 'monospace', fontSize: 11, color: '#888888' },
  infoVal: { fontFamily: 'monospace', fontSize: 11, color: '#00FF66', fontWeight: '600' },
});
