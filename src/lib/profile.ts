import * as SecureStore from 'expo-secure-store';

export interface UserProfile {
  name: string;
  avatar?: string;
  defaultCurrency: string;
  createdAt: number;
  onboardingComplete: boolean;
  pinCode?: string;
  notificationsEnabled: boolean;
  weeklyReportEnabled: boolean;
}

const PROFILE_KEY = 'mv_user_profile';

const DEFAULT_PROFILE: UserProfile = {
  name: 'You',
  defaultCurrency: 'INR',
  createdAt: Date.now(),
  onboardingComplete: false,
  notificationsEnabled: true,
  weeklyReportEnabled: false,
};

export async function getProfile(): Promise<UserProfile> {
  const data = await SecureStore.getItemAsync(PROFILE_KEY);
  if (!data) return { ...DEFAULT_PROFILE };
  return { ...DEFAULT_PROFILE, ...JSON.parse(data) };
}

export async function saveProfile(profile: Partial<UserProfile>): Promise<UserProfile> {
  const current = await getProfile();
  const updated = { ...current, ...profile };
  await SecureStore.setItemAsync(PROFILE_KEY, JSON.stringify(updated));
  return updated;
}

export async function isOnboardingComplete(): Promise<boolean> {
  const profile = await getProfile();
  return profile.onboardingComplete;
}

export async function completeOnboarding(name: string, currency: string): Promise<UserProfile> {
  return saveProfile({
    name,
    defaultCurrency: currency,
    onboardingComplete: true,
    createdAt: Date.now(),
  });
}

export async function setPinCode(pin: string | undefined): Promise<void> {
  await saveProfile({ pinCode: pin });
}

export async function verifyPinCode(pin: string): Promise<boolean> {
  const profile = await getProfile();
  if (!profile.pinCode) return true;
  return profile.pinCode === pin;
}

export async function hasPinLock(): Promise<boolean> {
  const profile = await getProfile();
  return !!profile.pinCode;
}
