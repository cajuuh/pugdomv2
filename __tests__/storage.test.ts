import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Account } from '../services/mastodon/types';

// In-memory SecureStore that enforces the platform's key charset and rejects large values
const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => {
    const check = (key: string) => {
        if (!/^[A-Za-z0-9._-]+$/.test(key)) {
            throw new Error(`Invalid SecureStore key: ${key}`);
        }
    };
    return {
        getItemAsync: jest.fn(async (key: string) => {
            check(key);
            return mockStore.get(key) ?? null;
        }),
        setItemAsync: jest.fn(async (key: string, value: string) => {
            check(key);
            if (value.length > 2048) {
                throw new Error(`Value for ${key} is ${value.length} bytes`);
            }
            mockStore.set(key, value);
        }),
        deleteItemAsync: jest.fn(async (key: string) => {
            check(key);
            mockStore.delete(key);
        }),
    };
});

// The migration runs once per module instance, so each test loads a fresh copy
const loadStorage = () => {
    let storage!: typeof import('../services/storage');
    jest.isolateModules(() => {
        storage = require('../services/storage');
    });
    return storage;
};

const makeAccount = (acct: string): Account => ({
    id: `id-${acct}`,
    username: acct.split('@')[0],
    acct,
    display_name: `${acct} ${'✨'.repeat(20)}`,
    avatar: `https://files.example.social/accounts/avatars/000/000/001/original/${'a'.repeat(120)}.png`,
    emojis: [],
});

const legacyRecord = (acct: string, instanceUrl: string) => {
    const account = makeAccount(acct);
    return {
        id: `${acct}@${instanceUrl}`,
        accessToken: `token-${acct}`,
        instanceUrl,
        userInfo: {
            id: account.id,
            username: account.username,
            display_name: account.display_name,
            avatar: account.avatar,
            acct: account.acct,
        },
    };
};

describe('saved accounts storage', () => {
    beforeEach(() => {
        mockStore.clear();
        jest.clearAllMocks();
    });

    it('stores many accounts without any value exceeding the size limit', async () => {
        const storage = loadStorage();
        for (let i = 0; i < 12; i++) {
            await storage.addSavedAccount(`token-${i}`, `https://instance${i}.social`, makeAccount(`user${i}`));
        }

        const accounts = await storage.getSavedAccounts();
        expect(accounts).toHaveLength(12);
        expect(accounts[11]).toMatchObject({ id: 'user11@https://instance11.social', accessToken: 'token-11' });
        for (const value of mockStore.values()) {
            expect(value.length).toBeLessThanOrEqual(2048);
        }
    });

    it('uses SecureStore-safe keys for account ids with @, : and /', async () => {
        const storage = loadStorage();
        const key = storage.accountStorageKey('user@https://mastodon.social');
        expect(key).toMatch(/^[A-Za-z0-9._-]+$/);
        expect(storage.accountStorageKey('user@https://other.social')).not.toBe(key);
    });

    it('replaces an existing account instead of duplicating it', async () => {
        const storage = loadStorage();
        await storage.addSavedAccount('old-token', 'https://one.social', makeAccount('alice'));
        await storage.addSavedAccount('new-token', 'https://one.social', makeAccount('alice'));

        const accounts = await storage.getSavedAccounts();
        expect(accounts).toHaveLength(1);
        expect(accounts[0].accessToken).toBe('new-token');
    });

    it('removes an account and its record', async () => {
        const storage = loadStorage();
        await storage.addSavedAccount('a', 'https://one.social', makeAccount('alice'));
        await storage.addSavedAccount('b', 'https://two.social', makeAccount('bob'));

        await storage.removeSavedAccount('alice@https://one.social');

        expect((await storage.getSavedAccounts()).map(a => a.id)).toEqual(['bob@https://two.social']);
        expect(mockStore.has(storage.accountStorageKey('alice@https://one.social'))).toBe(false);
    });

    it('migrates the legacy single-array format once and removes it', async () => {
        const legacy = [legacyRecord('alice', 'https://one.social'), legacyRecord('bob', 'https://two.social')];
        mockStore.set('pugdom_saved_accounts', JSON.stringify(legacy));
        const storage = loadStorage();

        const [first, second] = await Promise.all([storage.getSavedAccounts(), storage.getSavedAccounts()]);

        expect(first).toEqual(legacy);
        expect(second).toEqual(legacy);
        expect(mockStore.has('pugdom_saved_accounts')).toBe(false);
        expect(JSON.parse(mockStore.get('pugdom_account_index')!)).toEqual(legacy.map(a => a.id));
    });

    it('keeps the legacy data if migration fails, and retries next time', async () => {
        const legacy = [legacyRecord('alice', 'https://one.social')];
        mockStore.set('pugdom_saved_accounts', JSON.stringify(legacy));
        const storage = loadStorage();
        (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(new Error('keychain locked'));

        await expect(storage.getSavedAccounts()).rejects.toThrow('keychain locked');
        expect(mockStore.has('pugdom_saved_accounts')).toBe(true);

        expect(await storage.getSavedAccounts()).toEqual(legacy);
        expect(mockStore.has('pugdom_saved_accounts')).toBe(false);
    });

    it('skips index entries whose record is missing', async () => {
        const storage = loadStorage();
        await storage.addSavedAccount('a', 'https://one.social', makeAccount('alice'));
        mockStore.set('pugdom_account_index', JSON.stringify(['ghost@https://gone.social', 'alice@https://one.social']));

        expect((await storage.getSavedAccounts()).map(a => a.id)).toEqual(['alice@https://one.social']);
    });

    describe('on web', () => {
        const webStore = new Map<string, string>();

        beforeEach(() => {
            webStore.clear();
            jest.replaceProperty(Platform, 'OS', 'web');
            (global as any).localStorage = {
                getItem: (key: string) => webStore.get(key) ?? null,
                setItem: (key: string, value: string) => webStore.set(key, value),
                removeItem: (key: string) => webStore.delete(key),
            };
        });

        afterEach(() => {
            jest.restoreAllMocks();
            delete (global as any).localStorage;
        });

        it('uses localStorage instead of SecureStore', async () => {
            const storage = loadStorage();
            await storage.addSavedAccount('a', 'https://one.social', makeAccount('alice'));
            await storage.saveCredentials('a', 'https://one.social');

            expect((await storage.getSavedAccounts()).map(a => a.id)).toEqual(['alice@https://one.social']);
            expect(await storage.getCredentials()).toEqual({ accessToken: 'a', instanceUrl: 'https://one.social' });
            expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
        });
    });
});
