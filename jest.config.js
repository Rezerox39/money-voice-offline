module.exports = {

  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^expo-crypto$': '<rootDir>/src/__mocks__/expo-crypto.ts',
    '^expo-speech-recognition$': '<rootDir>/src/__mocks__/expo-speech-recognition.ts',
    '^expo-speech$': '<rootDir>/src/__mocks__/expo-speech.ts',
    '^expo-linking$': '<rootDir>/src/__mocks__/expo-linking.ts',
    '^.*/lib/database$': '<rootDir>/src/__mocks__/database.ts',
    '^.*/lib/audioFeedback$': '<rootDir>/src/__mocks__/audioFeedback.ts',
    '^.*/lib/offlineSpeech$': '<rootDir>/src/__mocks__/offlineSpeech.ts',
    '^react-native$': '<rootDir>/src/__mocks__/react-native.ts',
  },
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json',
    },
  },
};
