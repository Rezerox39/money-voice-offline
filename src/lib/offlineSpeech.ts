// ─────────────────────────────────────────────────────────────────
// offlineSpeech.ts — True offline speech-to-text engine
// Uses expo-speech-recognition with requiresOnDeviceRecognition: true
// Fails immediately if on-device model is missing — no network calls.
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

const OFFLINE_CONFIG = {
  lang: 'en-IN',
  requiresOnDeviceRecognition: true, // CRITICAL: fail fast if no offline model
  addsPunctuation: false,
  interimResults: false,
  maxAlternatives: 1,
} as const;

const OFFLINE_MODEL_LOCALE = 'en-IN';

// ── Public API ─────────────────────────────────────────────────────

/**
 * Check if the device supports offline speech recognition.
 * Returns true only if an on-device model is installed and available.
 */
export async function isOfflineRecognitionAvailable(): Promise<boolean> {
  try {
    return ExpoSpeechRecognition.supportsOnDeviceRecognition();
  } catch {
    return false;
  }
}

/**
 * Check if the device has the required offline language model.
 * Returns a structured result with availability and guidance.
 */
export async function checkOfflineModelStatus(): Promise<{
  available: boolean;
  message: string;
}> {
  const supported = await isOfflineRecognitionAvailable();
  if (supported) {
    return {
      available: true,
      message: 'Offline speech model is installed and ready.',
    };
  }

  return {
    available: false,
    message:
      'Offline speech model required. Download offline language pack in Android Speech Settings.',
  };
}

/**
 * Attempt to trigger the offline model download dialog (Android 13+).
 * Returns the download status.
 */
export async function requestOfflineModelDownload(): Promise<{
  status: 'download_success' | 'opened_dialog' | 'download_scheduled' | 'unsupported';
  message: string;
}> {
  try {
    const result = await ExpoSpeechRecognition.androidTriggerOfflineModelDownload({
      locale: OFFLINE_MODEL_LOCALE,
    });
    return { status: result.status, message: result.message };
  } catch (e: any) {
    return {
      status: 'unsupported',
      message: `Model download not available: ${e?.message ?? 'unknown error'}`,
    };
  }
}

/**
 * Start offline speech recognition.
 * Returns a promise that resolves with the transcribed text.
 * Rejects immediately if on-device model is missing.
 */
export function startOfflineRecognition(): Promise<OfflineSTTResult> {
  return new Promise((resolve, reject) => {
    // Pre-flight: verify offline model is available
    const supported = ExpoSpeechRecognition.supportsOnDeviceRecognition();
    if (!supported) {
      reject({
        code: 'service-not-allowed',
        message:
          'Offline speech model required. Download offline language pack in Android Speech Settings.',
        isOfflineModelMissing: true,
      } satisfies OfflineSTTError);
      return;
    }

    // Set up event handlers before starting
    const removeResultListener = ExpoSpeechRecognition.addListener(
      'result',
      (event: any) => {
        if (event.isFinal && event.results.length > 0) {
          const best = event.results[0];
          // Stop recognition after final result
          ExpoSpeechRecognition.stop();
          removeResultListener();
          removeErrorListener();
          removeEndListener();
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
        removeResultListener();
        removeErrorListener();
        removeEndListener();

        const isOfflineMissing =
          event.error === 'service-not-allowed' ||
          event.error === 'language-not-supported';

        reject({
          code: event.error,
          message: isOfflineMissing
            ? 'Offline speech model required. Download offline language pack in Android Speech Settings.'
            : `Speech recognition error: ${event.error} — ${event.message}`,
          isOfflineModelMissing: isOfflineMissing,
        } satisfies OfflineSTTError);
      }
    );

    const removeEndListener = ExpoSpeechRecognition.addListener('end', () => {
      removeResultListener();
      removeErrorListener();
      removeEndListener();
    });

    // Start recognition with strict offline config
    ExpoSpeechRecognition.start(OFFLINE_CONFIG);
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
