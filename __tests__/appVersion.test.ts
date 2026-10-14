import { appVersionLabel, codeVersionLabel } from '../services/appVersion';
import { createTranslator } from '../services/i18n/translate';

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.0' } } }));
jest.mock('expo-updates', () => ({ __esModule: true, isEmbeddedLaunch: true, updateId: null, channel: null, createdAt: null }));

const updates = jest.requireMock('expo-updates');
const constants = jest.requireMock('expo-constants').default;

describe('appVersionLabel', () => {
    beforeEach(() => {
        constants.expoConfig = { version: '1.0.0' };
    });

    it("shows the installed build's version, even when running an update", () => {
        Object.assign(updates, { isEmbeddedLaunch: false, updateId: '1a2b3c4d-5e6f-7a8b-9c0d-112233445566' });
        expect(appVersionLabel()).toBe('1.0.0');
    });

    it('falls back when the config has no version', () => {
        constants.expoConfig = null;
        expect(appVersionLabel()).toBe('unknown');
    });
});

describe('codeVersionLabel', () => {
    const env = process.env.EXPO_PUBLIC_GIT_COMMIT;

    beforeEach(() => {
        Object.assign(updates, { isEmbeddedLaunch: true, updateId: null, channel: null, createdAt: null });
        delete process.env.EXPO_PUBLIC_GIT_COMMIT;
    });
    afterAll(() => {
        process.env.EXPO_PUBLIC_GIT_COMMIT = env;
    });

    it('says Built-in for the code the build came with', () => {
        expect(codeVersionLabel()).toBe('Built-in');
        expect(codeVersionLabel(createTranslator('pt-BR'))).toBe('Original da instalação');
    });

    it("shows an update's publish time, commit and channel", () => {
        process.env.EXPO_PUBLIC_GIT_COMMIT = '7e5b2ad552763f7b7a8818a4aac44a2add57d3dc';
        Object.assign(updates, { isEmbeddedLaunch: false, updateId: '01a13768-a31d-79ac', channel: 'production', createdAt: new Date(2026, 9, 13, 19, 36) });
        expect(codeVersionLabel()).toBe('2026-10-13 19:36 · 7e5b2ad (production)');
    });

    it('uses the update id when the commit is unknown', () => {
        Object.assign(updates, { isEmbeddedLaunch: false, updateId: '01a13768-a31d-79ac', channel: null, createdAt: null });
        expect(codeVersionLabel()).toBe('01a13768');
    });
});
