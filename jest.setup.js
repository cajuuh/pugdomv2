// Reanimated and Worklets need their native runtime, so use the JS mocks they ship for tests
jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// Native media modules with no jest implementation
jest.mock('expo-video', () => ({
    useVideoPlayer: () => ({ play: jest.fn(), pause: jest.fn(), loop: false }),
    VideoView: () => null,
}));
jest.mock('react-native-image-viewing', () => () => null);

// AsyncStorage's native module isn't available in jest; the package ships an in-memory mock
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

// The real SafeAreaProvider renders nothing until native code reports insets
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
