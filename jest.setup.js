// Reanimated and Worklets need their native runtime, so use the JS mocks they ship for tests
jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// Native media modules with no jest implementation
jest.mock('expo-video', () => ({
    useVideoPlayer: () => ({ play: jest.fn(), pause: jest.fn(), loop: false }),
    VideoView: () => null,
}));
jest.mock('react-native-image-viewing', () => () => null);
