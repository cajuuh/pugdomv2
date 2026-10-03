import { appVersionLabel } from '../services/appVersion';

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.0' } } }));
jest.mock('expo-updates', () => ({ __esModule: true, isEmbeddedLaunch: true, updateId: null, channel: null }));

const updates = jest.requireMock('expo-updates');
const constants = jest.requireMock('expo-constants').default;

describe('appVersionLabel', () => {
    beforeEach(() => {
        Object.assign(updates, { isEmbeddedLaunch: true, updateId: null, channel: null });
        constants.expoConfig = { version: '1.0.0' };
    });

    it('shows the app version for the build as installed', () => {
        expect(appVersionLabel()).toBe('1.0.0');
    });

    it('adds the update id and channel when running an OTA update', () => {
        Object.assign(updates, { isEmbeddedLaunch: false, updateId: '1a2b3c4d-5e6f-7a8b-9c0d-112233445566', channel: 'preview' });
        expect(appVersionLabel()).toBe('1.0.0 · update 1a2b3c4d (preview)');
    });

    it('omits the channel when there is none', () => {
        Object.assign(updates, { isEmbeddedLaunch: false, updateId: 'abcdef1234567890', channel: null });
        expect(appVersionLabel()).toBe('1.0.0 · update abcdef12');
    });

    it('falls back when the config has no version', () => {
        constants.expoConfig = null;
        expect(appVersionLabel()).toBe('unknown');
    });
});
