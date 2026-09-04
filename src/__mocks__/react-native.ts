// Minimal react-native mock for Jest (node environment)
// Only provides the APIs actually used in production code under test.

export const AppState = {
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  currentState: 'active',
};

export type AppStateStatus = 'active' | 'background' | 'inactive';

export const Platform = { OS: 'android' as const };

export const StyleSheet = {
  create: <T extends Record<string, any>>(styles: T): T => styles,
};

// Minimal component stubs for imports that flow through
export const View = 'View';
export const Text = 'Text';
export const TouchableOpacity = 'TouchableOpacity';
export const Pressable = 'Pressable';
export const FlatList = 'FlatList';
export const ScrollView = 'ScrollView';
export const Alert = { alert: jest.fn() };
export const Animated = {
  Value: jest.fn(() => ({ setValue: jest.fn() })),
  View: 'Animated.View',
  loop: jest.fn(() => ({ start: jest.fn(), stop: jest.fn() })),
  sequence: jest.fn(() => ({})),
  timing: jest.fn(() => ({ start: jest.fn() })),
};
