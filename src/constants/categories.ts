import { MaterialCommunityIcons } from '@expo/vector-icons';

export interface CategoryConfig {
  key: string;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
}

export const CATEGORY_CONFIGS: CategoryConfig[] = [
  { key: 'food', label: 'Food & Dining', icon: 'food', color: '#FF6B35' },
  { key: 'transport', label: 'Transport', icon: 'car', color: '#4ECDC4' },
  { key: 'accommodation', label: 'Accommodation', icon: 'home', color: '#45B7D1' },
  { key: 'shopping', label: 'Shopping', icon: 'shopping', color: '#96CEB4' },
  { key: 'entertainment', label: 'Entertainment', icon: 'gamepad-variant', color: '#FFEAA7' },
  { key: 'utilities', label: 'Utilities', icon: 'flash', color: '#DDA0DD' },
  { key: 'groceries', label: 'Groceries', icon: 'cart', color: '#98D8C8' },
  { key: 'health', label: 'Health', icon: 'heart-pulse', color: '#FF6B6B' },
  { key: 'education', label: 'Education', icon: 'school', color: '#74B9FF' },
  { key: 'personal', label: 'Personal', icon: 'account', color: '#A29BFE' },
  { key: 'work', label: 'Work', icon: 'briefcase', color: '#636E72' },
  { key: 'travel', label: 'Travel', icon: 'airplane', color: '#00CEC9' },
  { key: 'gifts', label: 'Gifts', icon: 'gift', color: '#FD79A8' },
  { key: 'pool', label: 'Pool Fund', icon: 'account-group', color: '#FDCB6E' },
  { key: 'other', label: 'Other', icon: 'dots-horizontal', color: '#B2BEC3' },
];

export function getCategoryConfig(category: string): CategoryConfig {
  const normalized = category.toLowerCase();
  return CATEGORY_CONFIGS.find(c => c.key === normalized) ||
    CATEGORY_CONFIGS.find(c => c.label.toLowerCase() === normalized) ||
    CATEGORY_CONFIGS[CATEGORY_CONFIGS.length - 1]; // fallback: 'other'
}
