import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';

// ── Haptic Patterns ────────────────────────────────────────────────

export async function hapticTick(): Promise<void> {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {}
}

export async function hapticSuccess(): Promise<void> {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {}
}

export async function hapticError(): Promise<void> {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {}
}

export async function hapticWarning(): Promise<void> {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {}
}

export async function hapticCountdown(): Promise<void> {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {}
}

// ── TTS Readout ────────────────────────────────────────────────────

export async function speakSettlement(text: string): Promise<void> {
  try {
    const isSpeaking = await Speech.isSpeakingAsync();
    if (isSpeaking) await Speech.stop();

    await Speech.speak(text, {
      language: 'en-IN',
      rate: 0.9,
      pitch: 1.0,
    });
  } catch {}
}

export async function speakConfirm(displayText: string): Promise<void> {
  // Short confirmation readout — just the key details
  try {
    await Speech.speak(`Confirmed: ${displayText}`, {
      language: 'en-IN',
      rate: 1.1,
      pitch: 1.0,
    });
  } catch {}
}

export async function speakError(message: string): Promise<void> {
  try {
    await Speech.speak(message, {
      language: 'en-IN',
      rate: 1.0,
      pitch: 0.8,
    });
  } catch {}
}

export async function stopSpeaking(): Promise<void> {
  try {
    await Speech.stop();
  } catch {}
}

// ── Combined Audio Cues ────────────────────────────────────────────

export async function audioParseSuccess(): Promise<void> {
  await hapticSuccess();
}

export async function audioParseError(): Promise<void> {
  await hapticError();
}

export async function audioAutoConfirm(): Promise<void> {
  await hapticTick();
  await hapticTick();
}

export async function audioCountdownTick(): Promise<void> {
  await hapticCountdown();
}
