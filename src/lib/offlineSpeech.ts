// ─────────────────────────────────────────────────────────────────
// offlineSpeech.ts — Speech-to-text engine
// Strategy: expo-speech-recognition → system RecognizerIntent → CLI
// ─────────────────────────────────────────────────────────────────

import { Platform, Linking } from 'react-native';

let ExpoSpeechRecognition: any = null;
let moduleAvailable = false;

try {
  const mod = require('expo-speech-recognition');
  ExpoSpeechRecognition = mod?.default ?? mod;
  moduleAvailable = ExpoSpeechRecognition && typeof ExpoSpeechRecognition.start === 'function';
} catch {
  moduleAvailable = false;
}

export interface OfflineSTTResult {
  transcript: string;
  confidence: number;
}

export interface OfflineSTTError {
  code: string;
  message: string;
  isOfflineModelMissing: boolean;
}

// ── System RecognizerIntent Fallback (Android) ─────────────────────

async function startSystemRecognizer(): Promise<OfflineSTTResult> {
  // Launch Android's native speech recognition via intent.
  // This uses Google's built-in speech service — always available on Android.
  return new Promise((resolve, reject) => {
    const intentUrl = 'intent:#Intent;action=android.speech.action.RECOGNIZE_SPEECH;S.speech=;S.prompts=Speak now;end';

    // Use Linking to open the speech recognition activity
    // On Android this opens Google's native mic dialog
    const speechUrl = `googleapp://voice`;

    // Alternative: use the speech recognizer intent directly
    // Since we can't easily get the result back from an intent,
    // we'll try the expo module first, then mark as unavailable
    // if both fail, the caller handles CLI fallback.

    // Try launching Google Voice Search intent
    Linking.canOpenURL('googleapp://voice').then((supported) => {
      if (supported) {
        Linking.openURL('googleapp://voice');
        // Note: This launches Google app but we can't get the result back
        // in a clean way from a generic intent. The expo-speech-recognition
        // module is the proper bridge. If that fails, we go to CLI.
      }
    }).catch(() => {});

    reject({
      code: 'system-intent-unavailable',
      message: 'Speech recognition not available. Use manual entry.',
      isOfflineModelMissing: false,
    } satisfies OfflineSTTError);
  });
}

// ── Public API ─────────────────────────────────────────────────────

export function isModuleAvailable(): boolean {
  return moduleAvailable;
}

export async function isOfflineRecognitionAvailable(): Promise<boolean> {
  if (!moduleAvailable) return false;
  try {
    return ExpoSpeechRecognition.supportsOnDeviceRecognition?.() ?? false;
  } catch {
    return false;
  }
}

/**
 * Start speech recognition with layered fallback:
 * 1. expo-speech-recognition (if native module linked)
 * 2. Reject with actionable error for CLI fallback
 */
export function startOfflineRecognition(): Promise<OfflineSTTResult> {
  return new Promise((resolve, reject) => {
    if (!moduleAvailable || !ExpoSpeechRecognition) {
      // Module not linked — fall through to CLI
      reject({
        code: 'module-not-available',
        message: 'Voice engine not loaded. Use manual entry below.',
        isOfflineModelMissing: false,
      } satisfies OfflineSTTError);
      return;
    }

    let hasResolved = false;

    function safeRemove(listener: any) {
      try { listener?.remove?.(); } catch {}
    }

    const removeResultListener = ExpoSpeechRecognition.addListener?.('result', (event: any) => {
      if (hasResolved) return;
      if (event.isFinal && event.results?.length > 0) {
        hasResolved = true;
        const best = event.results[0];
        try { ExpoSpeechRecognition.stop?.(); } catch {}
        cleanup();
        resolve({ transcript: best.transcript, confidence: best.confidence });
      }
    });

    const removeErrorListener = ExpoSpeechRecognition.addListener?.('error', (event: any) => {
      if (hasResolved) return;
      hasResolved = true;
      cleanup();
      const code = event.error || 'unknown';
      let message = `Speech error: ${code}`;
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        message = 'Microphone permission denied.';
      } else if (code === 'no-speech') {
        message = 'No speech detected. Try again.';
      } else if (code === 'client') {
        message = 'Speech service unavailable.';
      } else if (code === 'network' || code === 'network-timeout') {
        message = 'Network error. Check connection.';
      }
      reject({ code, message, isOfflineModelMissing: code === 'service-not-allowed' } satisfies OfflineSTTError);
    });

    const removeEndListener = ExpoSpeechRecognition.addListener?.('end', () => {
      cleanup();
      if (!hasResolved) {
        hasResolved = true;
        reject({ code: 'no-speech', message: 'No speech detected.', isOfflineModelMissing: false } satisfies OfflineSTTError);
      }
    });

    function cleanup() {
      safeRemove(removeResultListener);
      safeRemove(removeErrorListener);
      safeRemove(removeEndListener);
    }

    let useOffline = false;
    try { useOffline = ExpoSpeechRecognition.supportsOnDeviceRecognition?.() ?? false; } catch {}

    try {
      ExpoSpeechRecognition.start({ ...BASE_CONFIG, requiresOnDeviceRecognition: useOffline });
    } catch (err: any) {
      cleanup();
      hasResolved = true;
      reject({ code: 'start-failed', message: err?.message || 'Failed to start speech.', isOfflineModelMissing: false } satisfies OfflineSTTError);
    }
  });
}

export function stopRecognition(): void {
  if (!moduleAvailable) return;
  try { ExpoSpeechRecognition.stop?.(); } catch {}
}

export function abortRecognition(): void {
  if (!moduleAvailable) return;
  try { ExpoSpeechRecognition.abort?.(); } catch {}
}

const BASE_CONFIG = { lang: 'en-IN', addsPunctuation: false, interimResults: false, maxAlternatives: 1 };
