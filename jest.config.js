module.exports = {
  preset: 'jest-expo',
  setupFiles: ['./jest.setup.js'],
  setupFilesAfterEnv: ['./jest.afterEnv.js'],
  // The first render in a file compiles React Native: ~30s per worker on a cold cache (as in CI)
  testTimeout: 60000,
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@shopify/flash-list)'
  ],
};
