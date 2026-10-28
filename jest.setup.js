// Reanimated and Worklets need their native runtime, so use the JS mocks they ship for tests
jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// Native media modules with no jest implementation
jest.mock('expo-video', () => ({
    useVideoPlayer: () => ({ play: jest.fn(), pause: jest.fn(), loop: false }),
    VideoView: () => null,
}));
// Saving media to the gallery (see __tests__/saveMedia.test.tsx for an observable stand-in)
jest.mock('expo-media-library', () => ({
    Asset: { create: jest.fn(async () => ({})) },
    requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
}));
jest.mock('expo-file-system', () => ({
    Paths: { cache: 'file:///cache/' },
    Directory: jest.fn().mockImplementation(() => ({ create: jest.fn() })),
    File: { downloadFileAsync: jest.fn(async () => ({ uri: 'file:///cache/file', delete: jest.fn() })) },
}));

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
    const rendered = {
        width: 1000,
        height: 800,
        saveAsync: jest.fn(async () => ({ uri: 'file:///cache/converted.jpg', width: 1, height: 1 })),
    };
    const context = {
        resize: jest.fn(() => context),
        rotate: jest.fn(() => context),
        flip: jest.fn(() => context),
        crop: jest.fn(() => context),
        renderAsync: jest.fn(async () => rendered),
    };
    return {
        ImageManipulator: { manipulate: jest.fn(() => context) },
        SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
        FlipType: { Horizontal: 'horizontal', Vertical: 'vertical' },
    };
});

// Native push: permission granted, a fixed Expo token, no tapped notification
jest.mock('expo-notifications', () => ({
    setNotificationHandler: jest.fn(),
    setNotificationChannelAsync: jest.fn(async () => null),
    getPermissionsAsync: jest.fn(async () => ({ granted: true })),
    requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
    getExpoPushTokenAsync: jest.fn(async () => ({ type: 'expo', data: 'ExponentPushToken[test]' })),
    useLastNotificationResponse: jest.fn(() => null),
    clearLastNotificationResponse: jest.fn(),
    DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
    AndroidImportance: { HIGH: 5 },
}));
