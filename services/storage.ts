import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Account } from './mastodon/types';

const TOKEN_KEY = 'pugdom_access_token';
const INSTANCE_KEY = 'pugdom_instance_url';

export interface Credentials {
    accessToken: string | null;
    instanceUrl: string | null;
}

export interface SavedAccount {
    id: string; // unique ID: acct@instanceUrl
    accessToken: string;
    instanceUrl: string;
    userInfo: {
        id: string;
        username: string;
        display_name: string;
        avatar: string;
        acct: string;
    };
}

// Saved accounts are stored one per key (plus an index of ids), because SecureStore
// can reject large values and a single JSON array of every account grows without bound
const LEGACY_SAVED_ACCOUNTS_KEY = 'pugdom_saved_accounts';
const ACCOUNT_INDEX_KEY = 'pugdom_account_index';
const ACCOUNT_KEY_PREFIX = 'pugdom_account_';

// SecureStore keys only allow [A-Za-z0-9._-], and account ids contain '@', ':' and '/'
export const accountStorageKey = (id: string) =>
    ACCOUNT_KEY_PREFIX + Array.from(new TextEncoder().encode(id), byte => byte.toString(16).padStart(2, '0')).join('');

async function getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
        return localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string) {
    if (Platform.OS === 'web') {
        localStorage.setItem(key, value);
        return;
    }
    await SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string) {
    if (Platform.OS === 'web') {
        localStorage.removeItem(key);
        return;
    }
    await SecureStore.deleteItemAsync(key);
}

export async function saveCredentials(accessToken: string, instanceUrl: string) {
    await setItem(TOKEN_KEY, accessToken);
    await setItem(INSTANCE_KEY, instanceUrl);
}

export async function getCredentials(): Promise<Credentials> {
    const accessToken = await getItem(TOKEN_KEY);
    const instanceUrl = await getItem(INSTANCE_KEY);
    return { accessToken, instanceUrl };
}

export async function clearCredentials() {
    await deleteItem(TOKEN_KEY);
    await deleteItem(INSTANCE_KEY);
}

async function readAccountIndex(): Promise<string[]> {
    const data = await getItem(ACCOUNT_INDEX_KEY);
    return data ? JSON.parse(data) : [];
}

async function writeAccountIndex(ids: string[]) {
    await setItem(ACCOUNT_INDEX_KEY, JSON.stringify(ids));
}

// One-time move from the single-array format. The legacy key is only removed once every
// account has been written, so an interrupted migration is retried on the next call.
let legacyMigration: Promise<void> | null = null;

function migrateLegacyAccounts(): Promise<void> {
    if (!legacyMigration) {
        legacyMigration = (async () => {
            const legacy = await getItem(LEGACY_SAVED_ACCOUNTS_KEY);
            if (!legacy) {
                return;
            }
            const accounts: SavedAccount[] = JSON.parse(legacy);
            for (const account of accounts) {
                await setItem(accountStorageKey(account.id), JSON.stringify(account));
            }
            const index = await readAccountIndex();
            await writeAccountIndex([...index, ...accounts.map(a => a.id).filter(id => !index.includes(id))]);
            await deleteItem(LEGACY_SAVED_ACCOUNTS_KEY);
        })().catch(error => {
            legacyMigration = null;
            throw error;
        });
    }
    return legacyMigration;
}

export async function getSavedAccounts(): Promise<SavedAccount[]> {
    await migrateLegacyAccounts();
    const ids = await readAccountIndex();
    const records = await Promise.all(ids.map(id => getItem(accountStorageKey(id))));
    // Skip ids whose record is missing (e.g. a write interrupted between record and index)
    return records.filter((data): data is string => !!data).map(data => JSON.parse(data));
}

export async function addSavedAccount(accessToken: string, instanceUrl: string, userInfo: Account) {
    await migrateLegacyAccounts();
    const id = `${userInfo.acct}@${instanceUrl}`;
    const newAccount: SavedAccount = {
        id,
        accessToken,
        instanceUrl,
        userInfo: {
            id: userInfo.id,
            username: userInfo.username,
            display_name: userInfo.display_name,
            avatar: userInfo.avatar,
            acct: userInfo.acct
        }
    };

    // Write the record before the index, so the index never points at a missing account
    await setItem(accountStorageKey(id), JSON.stringify(newAccount));
    const index = await readAccountIndex();
    await writeAccountIndex([...index.filter(existing => existing !== id), id]);
}

export async function removeSavedAccount(id: string) {
    await migrateLegacyAccounts();
    const index = await readAccountIndex();
    await writeAccountIndex(index.filter(existing => existing !== id));
    await deleteItem(accountStorageKey(id));
}

export async function saveSetting(key: string, value: boolean) {
    await setItem(key, value ? 'true' : 'false');
}

export async function getSetting(key: string, defaultValue: boolean): Promise<boolean> {
    const val = await getItem(key);
    return val !== null ? val === 'true' : defaultValue;
}

export async function saveStringSetting(key: string, value: string) {
    await setItem(key, value);
}

export async function getStringSetting(key: string, defaultValue: string): Promise<string> {
    const val = await getItem(key);
    return val !== null ? val : defaultValue;
}
