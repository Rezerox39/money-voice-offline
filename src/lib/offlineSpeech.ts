// ─────────────────────────────────────────────────────────────────
// offlineSpeech.ts — Speech-to-text engine
// Uses expo-speech-recognition with defensive module binding.
// Falls back gracefully if native module is not linked.
// ─────────────────────────────────────────────────────────────────

let ExpoSpeechRecognition: any = null;
let moduleAvailable = false;

try {
  const mod = require('expo-speech-recognition');
  ExpoSpeechRecognition = mod?.default ?? mod;
  // Verify the module has the expected start method
  moduleAvailable = ExpoSpeechRecognition && typeof ExpoSpeechRecognition.start === 'function';
} catch {
  moduleAvailable = false;
}

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
 * Start speech recognition. Returns immediately with an error result
 * if the native module is not linked.
 */
export function startOfflineRecognition(): Promise<OfflineSTTResult> {
  return new Promise((resolve, reject) => {
    if (!moduleAvailable || !ExpoSpeechRecognition) {
      reject({
        code: 'module-not-available',
        message: 'Speech engine not available on this device.',
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
      reject({ code: 'start-failed', message: err?.message || 'Failed to start speech engine.', isOfflineModelMissing: false } satisfies OfflineSTTError);
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
