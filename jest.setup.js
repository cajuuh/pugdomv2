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

// The app defaults to Portuguese; tests run in English unless they pick a language
jest.mock('./services/i18n/defaults', () => ({
    ...jest.requireActual('./services/i18n/defaults'),
    DEFAULT_LANGUAGE: 'en',
}));

// Native image modules: tests mock what they return (see __tests__/media.test.tsx)
jest.mock('expo-image-picker', () => ({
    launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: null })),
    launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: null })),
    requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
}));
jest.mock('expo-image-manipulator', () => {
    const context = {
        resize: jest.fn(() => context),
        renderAsync: jest.fn(async () => ({ saveAsync: jest.fn(async () => ({ uri: 'file:///cache/converted.jpg', width: 1, height: 1 })) })),
    };
    return {
        ImageManipulator: { manipulate: jest.fn(() => context) },
        SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
    };
});
