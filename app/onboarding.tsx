import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Dimensions, Platform, ScrollView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { completeOnboarding } from '../src/lib/profile';
import { CURRENCIES } from '../src/types';

const { width: SCREEN_W } = Dimensions.get('window');

const STEPS = [
  {
    icon: 'mic-outline' as const,
    title: 'Voice-First Tracking',
    subtitle: 'Speak naturally. Say "Chai 30" or "Dinner 1200 split with all" and we handle the rest.',
    accent: '#00FF66',
  },
  {
    icon: 'people-outline' as const,
    title: 'Group Trip Splitting',
    subtitle: 'Create trips, add members, split expenses equally or by custom amounts. Zero internet needed.',
    accent: '#FFB000',
  },
  {
    icon: 'qr-code-outline' as const,
    title: 'Offline QR Sync',
    subtitle: 'Sync trips between phones using animated QR codes. No servers, no accounts, pure peer-to-peer.',
    accent: '#3366FF',
  },
  {
    icon: 'shield-checkmark-outline' as const,
    title: '100% Offline & Private',
    subtitle: 'All data stays on your device. No cloud, no tracking, no accounts. You own your data.',
    accent: '#00FF66',
  },
];

const CURRENCY_LIST = Object.entries(CURRENCIES);

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState('INR');
  const scrollRef = useRef<ScrollView>(null);

  const isSetupStep = step === STEPS.length;

  function handleNext() {
    if (step < STEPS.length) {
      const next = step + 1;
      setStep(next);
      scrollRef.current?.scrollTo({ x: next * SCREEN_W, animated: true });
    }
  }

  function handlePrev() {
    if (step > 0) {
      const prev = step - 1;
      setStep(prev);
      scrollRef.current?.scrollTo({ x: prev * SCREEN_W, animated: true });
    }
  }

  async function handleFinish() {
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter your name to continue.');
      return;
    }
    await completeOnboarding(name.trim(), selectedCurrency);
    router.replace('/');
  }

  function handleSkip() {
    completeOnboarding('You', 'INR');
    router.replace('/');
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        contentContainerStyle={styles.scrollContent}
      >
        {STEPS.map((s, i) => (
          <View key={i} style={styles.slide}>
            <View style={[styles.iconCircle, { borderColor: s.accent }]}>
              <Ionicons name={s.icon} size={48} color={s.accent} />
            </View>
            <Text style={[styles.slideTitle, { color: s.accent }]}>{s.title}</Text>
            <Text style={styles.slideSubtitle}>{s.subtitle}</Text>
          </View>
        ))}

        {/* Setup Step */}
        <View style={styles.slide}>
          <View style={styles.setupCard}>
            <Ionicons name="finger-print-outline" size={36} color="#00FF66" />
            <Text style={styles.setupTitle}>SETUP YOUR NODE</Text>
            <Text style={styles.setupSubtitle}>Quick setup. No account needed.</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>YOUR NAME</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your name"
                placeholderTextColor="#555555"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                maxLength={30}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>DEFAULT CURRENCY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.currencyScroll}>
                {CURRENCY_LIST.map(([code, info]) => (
                  <TouchableOpacity
                    key={code}
                    style={[styles.currencyChip, selectedCurrency === code && styles.currencyChipActive]}
                    onPress={() => setSelectedCurrency(code)}
                  >
                    <Text style={[styles.currencyChipText, selectedCurrency === code && styles.currencyChipTextActive]}>
                      {info.symbol} {code}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Progress Dots */}
      <View style={styles.dotsRow}>
        {STEPS.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i <= step && styles.dotActive]}
          />
        ))}
      </View>

      {/* Navigation */}
      <View style={styles.navRow}>
        {step > 0 ? (
          <TouchableOpacity style={styles.navBtn} onPress={handlePrev}>
            <Ionicons name="chevron-back" size={18} color="#888888" />
            <Text style={styles.navBtnText}>BACK</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.navBtn} onPress={handleSkip}>
            <Text style={styles.navBtnText}>SKIP</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.navBtnPrimary, (!isSetupStep || !name.trim()) && styles.navBtnPrimaryDisabled]}
          onPress={isSetupStep ? handleFinish : handleNext}
        >
          <Text style={styles.navBtnPrimaryText}>
            {isSetupStep ? 'START TRACKING' : 'NEXT'}
          </Text>
          {!isSetupStep && <Ionicons name="chevron-forward" size={18} color="#000000" />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  scrollContent: { flexGrow: 1 },
  slide: {
    width: SCREEN_W,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  slideTitle: {
    fontFamily: 'monospace',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  slideSubtitle: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: '#888888',
    textAlign: 'center',
    lineHeight: 20,
  },
  setupCard: {
    backgroundColor: '#0A0A0A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#222222',
    padding: 24,
    alignItems: 'center',
    gap: 16,
    width: '100%',
  },
  setupTitle: {
    fontFamily: 'monospace',
    fontSize: 16,
    color: '#00FF66',
    fontWeight: '700',
    letterSpacing: 2,
  },
  setupSubtitle: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#888888',
  },
  inputGroup: { width: '100%', gap: 6 },
  inputLabel: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#FFB000',
    letterSpacing: 1,
    fontWeight: '700',
  },
  input: {
    fontFamily: 'monospace',
    fontSize: 14,
    color: '#E0E0E0',
    backgroundColor: '#1F1F1F',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#333333',
    padding: 12,
  },
  currencyScroll: { flexDirection: 'row' },
  currencyChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#333333',
    backgroundColor: '#1F1F1F',
    marginRight: 8,
  },
  currencyChipActive: {
    borderColor: '#00FF66',
    backgroundColor: '#003311',
  },
  currencyChipText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#888888',
  },
  currencyChipTextActive: {
    color: '#00FF66',
    fontWeight: '700',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#333333',
  },
  dotActive: {
    backgroundColor: '#00FF66',
    width: 24,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'android' ? 32 : 16,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 12,
  },
  navBtnText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#888888',
    letterSpacing: 1,
  },
  navBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#00FF66',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 4,
  },
  navBtnPrimaryDisabled: {
    opacity: 0.3,
  },
  navBtnPrimaryText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#000000',
    fontWeight: '700',
    letterSpacing: 1,
  },
});
