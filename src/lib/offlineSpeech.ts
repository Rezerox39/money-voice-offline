// ─────────────────────────────────────────────────────────────────
// offlineSpeech.ts — Speech-to-text engine
// Uses expo-speech-recognition. Tries on-device first, falls back
// to network speech if no offline model is available.
// ─────────────────────────────────────────────────────────────────

// @ts-ignore — expo-speech-recognition runtime API differs from bundled types
const ExpoSpeechRecognition = require('expo-speech-recognition').default ?? require('expo-speech-recognition');

export type OfflineSTTState = 'idle' | 'listening' | 'processing' | 'error';

export interface OfflineSTTResult {
  transcript: string;
  confidence: number;
}

export interface OfflineSTTError {
  code: string;
  message: string;
  isOfflineModelMissing: boolean;
}

// ── Configuration ──────────────────────────────────────────────────

const BASE_CONFIG = {
  lang: 'en-IN',
  addsPunctuation: false,
  interimResults: false,
  maxAlternatives: 1,
};

// ── Public API ─────────────────────────────────────────────────────

/**
 * Check if the device supports on-device recognition.
 */
export async function isOfflineRecognitionAvailable(): Promise<boolean> {
  try {
    return ExpoSpeechRecognition.supportsOnDeviceRecognition();
  } catch {
    return false;
  }
}

/**
 * Start speech recognition. Tries offline first, falls back to
 * whatever speech engine the device has available.
 * No longer hard-blocks if offline model is missing.
 */
export function startOfflineRecognition(): Promise<OfflineSTTResult> {
  return new Promise((resolve, reject) => {
    let hasResolved = false;

    // Set up event handlers before starting
    const removeResultListener = ExpoSpeechRecognition.addListener(
      'result',
      (event: any) => {
        if (hasResolved) return;
        if (event.isFinal && event.results.length > 0) {
          hasResolved = true;
          const best = event.results[0];
          ExpoSpeechRecognition.stop();
          cleanup();
          resolve({
            transcript: best.transcript,
            confidence: best.confidence,
          });
        }
      }
    );

    const removeErrorListener = ExpoSpeechRecognition.addListener(
      'error',
      (event: any) => {
        if (hasResolved) return;
        hasResolved = true;
        cleanup();

        // Map error codes to user-friendly messages
        const code = event.error;
        let message = `Speech recognition error: ${code}`;
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          message = 'Microphone permission denied. Grant permission in Settings.';
        } else if (code === 'no-speech') {
          message = 'No speech detected. Try again.';
        } else if (code === 'network' || code === 'network-timeout') {
          message = 'Network unavailable for speech. Check your connection.';
        } else if (code === 'language-not-supported') {
          message = 'Language not supported by this device.';
        } else if (code === 'client') {
          message = 'Speech service unavailable. Is Google app installed?';
        }

        reject({
          code,
          message,
          isOfflineModelMissing: code === 'service-not-allowed',
        } satisfies OfflineSTTError);
      }
    );

    const removeEndListener = ExpoSpeechRecognition.addListener('end', () => {
      cleanup();
      if (!hasResolved) {
        hasResolved = true;
        reject({
          code: 'no-speech',
          message: 'No speech detected. Try again.',
          isOfflineModelMissing: false,
        } satisfies OfflineSTTError);
      }
    });

    function cleanup() {
      removeResultListener();
      removeErrorListener();
      removeEndListener();
    }

    // Try offline first, fall back to whatever is available
    let useOffline = false;
    try {
      useOffline = ExpoSpeechRecognition.supportsOnDeviceRecognition();
    } catch {
      useOffline = false;
    }

    const config = {
      ...BASE_CONFIG,
      requiresOnDeviceRecognition: useOffline,
    };

    ExpoSpeechRecognition.start(config);
  });
}

/**
 * Stop any active recognition session.
 */
export function stopRecognition(): void {
  try {
    ExpoSpeechRecognition.stop();
  } catch {
    // Ignore — may not be running
  }
}

/**
 * Abort recognition immediately (no partial results kept).
 */
export function abortRecognition(): void {
  try {
    ExpoSpeechRecognition.abort();
  } catch {
    // Ignore
  }
}
