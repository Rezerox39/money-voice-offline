import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Dimensions, Platform, ScrollView, Alert, PermissionsAndroid,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { completeOnboarding } from '../src/lib/profile';
import { seedPlayground } from '../src/lib/database';
import { CURRENCIES } from '../src/types';

const { width: SCREEN_W } = Dimensions.get('window');

const CURRENCY_LIST = Object.entries(CURRENCIES);

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState('INR');
  const [isSeeding, setIsSeeding] = useState(false);
  const [micGranted, setMicGranted] = useState(false);
  const [camGranted, setCamGranted] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  function goToStep(s: number) {
    setStep(s);
    scrollRef.current?.scrollTo({ x: (s - 1) * SCREEN_W, animated: true });
  }

  async function requestAllPermissions() {
    try {
      const mic = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        { title: 'Microphone', message: 'For voice commands and expenses.', buttonPositive: 'Allow' }
      );
      setMicGranted(mic === PermissionsAndroid.RESULTS.GRANTED);

      const cam = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        { title: 'Camera', message: 'For scanning QR codes to sync trips.', buttonPositive: 'Allow' }
      );
      setCamGranted(cam === PermissionsAndroid.RESULTS.GRANTED);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      goToStep(3);
    } catch (err) {
      console.warn('[PERMS] Error requesting permissions:', err);
      goToStep(3);
    }
  }

  async function handleProceedBlank() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter your node call-sign.');
      return;
    }
    await completeOnboarding(name.trim(), selectedCurrency);
    router.replace('/');
  }

  async function handleLoadPlayground() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsSeeding(true);
    try {
      if (!name.trim()) {
        Alert.alert('Name Required', 'Please enter your node call-sign.');
        setIsSeeding(false);
        return;
      }
      await completeOnboarding(name.trim(), selectedCurrency);
      await seedPlayground();
      router.replace('/');
    } catch (err: any) {
      Alert.alert('Seed Failed', err?.message ?? 'Unknown error');
      setIsSeeding(false);
    }
  }

  function handleSkip() {
    completeOnboarding('You', 'INR');
    router.replace('/');
  }

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 24), paddingBottom: Math.max(insets.bottom, 16) }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Step 1: Identify Your Node */}
        <View style={styles.slide}>
          <View style={[styles.iconCircle, { borderColor: '#00FF66' }]}>
            <Ionicons name="finger-print-outline" size={48} color="#00FF66" />
          </View>
          <Text style={[styles.slideTitle, { color: '#00FF66' }]}>IDENTIFY YOUR NODE</Text>
          <Text style={styles.slideSubtitle}>What should we call you?</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>CALL-SIGN</Text>
            <TextInput
              style={styles.input}
              placeholder="You"
              placeholderTextColor="#555555"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              maxLength={30}
              autoFocus
            />
          </View>
          <TouchableOpacity
            style={[styles.navBtnPrimary, !name.trim() && styles.navBtnPrimaryDisabled]}
            onPress={() => { if (name.trim()) goToStep(2); }}
            disabled={!name.trim()}
          >
            <Text style={styles.navBtnPrimaryText}>CONTINUE</Text>
          </TouchableOpacity>
        </View>

        {/* Step 2: Currency */}
        <View style={styles.slide}>
          <View style={[styles.iconCircle, { borderColor: '#FFB000' }]}>
            <Ionicons name="cash-outline" size={48} color="#FFB000" />
          </View>
          <Text style={[styles.slideTitle, { color: '#FFB000' }]}>DEFAULT CURRENCY</Text>
          <Text style={styles.slideSubtitle}>Choose your primary currency</Text>
          <View style={styles.currencyGrid}>
            {CURRENCY_LIST.map(([code, info]) => (
              <TouchableOpacity
                key={code}
                style={[styles.currencyBtn, selectedCurrency === code && styles.currencyBtnActive]}
                onPress={() => { Haptics.selectionAsync(); setSelectedCurrency(code); }}
              >
                <Text style={styles.currencySymbol}>{info.symbol}</Text>
                <Text style={[styles.currencyCode, selectedCurrency === code && styles.currencyCodeActive]}>{code}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={styles.navBtnPrimary}
            onPress={() => goToStep(3)}
          >
            <Text style={styles.navBtnPrimaryText}>CONTINUE</Text>
          </TouchableOpacity>
        </View>

        {/* Step 3: Permissions */}
        <View style={styles.slide}>
          <View style={[styles.iconCircle, { borderColor: '#FF3333' }]}>
            <Ionicons name="shield-checkmark-outline" size={48} color="#FF3333" />
          </View>
          <Text style={[styles.slideTitle, { color: '#FF3333' }]}>APP PERMISSIONS</Text>
          <Text style={styles.slideSubtitle}>Allow these for the full experience</Text>

          <View style={styles.permList}>
            <View style={[styles.permItem, micGranted && styles.permItemGranted]}>
              <Ionicons name="mic-outline" size={20} color={micGranted ? '#00FF66' : '#FF3333'} />
              <View style={styles.permInfo}>
                <Text style={styles.permName}>MICROPHONE</Text>
                <Text style={styles.permDesc}>Voice commands for expenses</Text>
              </View>
              {micGranted ? <Text style={styles.permCheck}>GRANTED</Text> : null}
            </View>

            <View style={[styles.permItem, camGranted && styles.permItemGranted]}>
              <Ionicons name="camera-outline" size={20} color={camGranted ? '#00FF66' : '#FF3333'} />
              <View style={styles.permInfo}>
                <Text style={styles.permName}>CAMERA</Text>
                <Text style={styles.permDesc}>QR code sync for trips</Text>
              </View>
              {camGranted ? <Text style={styles.permCheck}>GRANTED</Text> : null}
            </View>
          </View>

          <TouchableOpacity style={styles.navBtnPrimary} onPress={requestAllPermissions}>
            <Ionicons name="shield-checkmark" size={16} color="#000000" />
            <Text style={styles.navBtnPrimaryText}>ALLOW & CONTINUE</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipPermBtn}
            onPress={() => goToStep(4)}
          >
            <Text style={styles.skipPermBtnText}>SKIP FOR NOW</Text>
          </TouchableOpacity>
        </View>

        {/* Step 4: Action Selector */}
        <View style={styles.slide}>
          <View style={[styles.iconCircle, { borderColor: '#3366FF' }]}>
            <Ionicons name="rocket-outline" size={48} color="#3366FF" />
          </View>
          <Text style={[styles.slideTitle, { color: '#3366FF' }]}>LAUNCH SEQUENCE</Text>
          <Text style={styles.slideSubtitle}>Ready to go, {name || 'Node'}.</Text>

          <TouchableOpacity
            style={styles.playgroundBtn}
            onPress={handleLoadPlayground}
            disabled={isSeeding}
          >
            <Ionicons name="flash" size={20} color="#00FF66" />
            <View style={styles.playgroundInfo}>
              <Text style={styles.playgroundTitle}>LOAD SAMPLE PLAYGROUND</Text>
              <Text style={styles.playgroundDesc}>#ladakh-expedition · 4 members · ₹5,000 kitty</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.blankBtn}
            onPress={handleProceedBlank}
          >
            <Text style={styles.blankBtnText}>PROCEED BLANK</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Progress Dots */}
      <View style={styles.dotsRow}>
        {[1, 2, 3, 4].map(s => (
          <View key={s} style={[styles.dot, step >= s && styles.dotActive]} />
        ))}
      </View>

      {/* Skip */}
      <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
        <Text style={styles.skipBtnText}>SKIP</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  scrollContent: { flexGrow: 1 },
  slide: {
    width: SCREEN_W, flex: 1, justifyContent: 'center',
    alignItems: 'center', paddingHorizontal: 32,
  },
  iconCircle: {
    width: 100, height: 100, borderRadius: 50, borderWidth: 2,
    justifyContent: 'center', alignItems: 'center', marginBottom: 24,
  },
  slideTitle: {
    fontFamily: 'monospace', fontSize: 20, fontWeight: '700',
    textAlign: 'center', marginBottom: 8,
  },
  slideSubtitle: {
    fontFamily: 'monospace', fontSize: 13, color: '#888888',
    textAlign: 'center', marginBottom: 24,
  },
  inputGroup: { width: '100%', gap: 6, marginBottom: 20 },
  inputLabel: {
    fontFamily: 'monospace', fontSize: 10, color: '#FFB000',
    letterSpacing: 1, fontWeight: '700',
  },
  input: {
    fontFamily: 'monospace', fontSize: 14, color: '#E0E0E0',
    backgroundColor: '#1F1F1F', borderRadius: 4, borderWidth: 1,
    borderColor: '#333333', padding: 12,
  },
  currencyGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12,
    justifyContent: 'center', marginBottom: 24,
  },
  currencyBtn: {
    width: 80, alignItems: 'center', paddingVertical: 12,
    borderRadius: 6, borderWidth: 1, borderColor: '#333333',
    backgroundColor: '#1F1F1F',
  },
  currencyBtnActive: { borderColor: '#FFB000', backgroundColor: '#332200' },
  currencySymbol: { fontSize: 20, marginBottom: 4 },
  currencyCode: {
    fontFamily: 'monospace', fontSize: 11, color: '#888888',
  },
  currencyCodeActive: { color: '#FFB000', fontWeight: '700' },
  playgroundBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    width: '100%', backgroundColor: '#0A0A0A', borderRadius: 6,
    padding: 16, borderWidth: 1, borderColor: '#00FF66', marginBottom: 12,
  },
  playgroundInfo: { flex: 1 },
  playgroundTitle: {
    fontFamily: 'monospace', fontSize: 12, color: '#00FF66',
    fontWeight: '700', letterSpacing: 1,
  },
  playgroundDesc: {
    fontFamily: 'monospace', fontSize: 10, color: '#888888', marginTop: 4,
  },
  blankBtn: {
    width: '100%', paddingVertical: 14, borderRadius: 6,
    borderWidth: 1, borderColor: '#333333', alignItems: 'center',
  },
  blankBtnText: {
    fontFamily: 'monospace', fontSize: 12, color: '#888888',
    letterSpacing: 1, fontWeight: '700',
  },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#333333' },
  dotActive: { backgroundColor: '#00FF66', width: 24 },
  navBtnPrimary: {
    backgroundColor: '#00FF66', paddingVertical: 14, paddingHorizontal: 32,
    borderRadius: 4, width: '100%', alignItems: 'center',
  },
  navBtnPrimaryDisabled: { opacity: 0.3 },
  navBtnPrimaryText: {
    fontFamily: 'monospace', fontSize: 12, color: '#000000',
    fontWeight: '700', letterSpacing: 1,
  },
  skipPermBtn: { paddingVertical: 12, marginTop: 8 },
  skipPermBtnText: { fontFamily: 'monospace', fontSize: 11, color: '#555555', letterSpacing: 1, textDecorationLine: 'underline' },
  permList: { width: '100%', gap: 12, marginBottom: 20 },
  permItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#1F1F1F', borderRadius: 6, padding: 14,
    borderWidth: 1, borderColor: '#FF3333',
  },
  permItemGranted: { borderColor: '#00FF66' },
  permInfo: { flex: 1 },
  permName: { fontFamily: 'monospace', fontSize: 12, color: '#E0E0E0', fontWeight: '700', letterSpacing: 0.5 },
  permDesc: { fontFamily: 'monospace', fontSize: 10, color: '#555555', marginTop: 2 },
  permCheck: { fontFamily: 'monospace', fontSize: 10, color: '#00FF66', fontWeight: '700', letterSpacing: 1 },
  skipBtn: { alignSelf: 'center', padding: 12 },
  skipBtnText: { fontFamily: 'monospace', fontSize: 12, color: '#555555', letterSpacing: 1 },
});
