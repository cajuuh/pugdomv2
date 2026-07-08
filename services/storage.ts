import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

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

const SAVED_ACCOUNTS_KEY = 'pugdom_saved_accounts';

export async function saveCredentials(accessToken: string, instanceUrl: string) {
    if (Platform.OS === 'web') {
        localStorage.setItem(TOKEN_KEY, accessToken);
        localStorage.setItem(INSTANCE_KEY, instanceUrl);
        return;
    }
    await SecureStore.setItemAsync(TOKEN_KEY, accessToken);
    await SecureStore.setItemAsync(INSTANCE_KEY, instanceUrl);
}

export async function getCredentials(): Promise<Credentials> {
    if (Platform.OS === 'web') {
        const accessToken = localStorage.getItem(TOKEN_KEY);
        const instanceUrl = localStorage.getItem(INSTANCE_KEY);
        return { accessToken, instanceUrl };
    }
    const accessToken = await SecureStore.getItemAsync(TOKEN_KEY);
    const instanceUrl = await SecureStore.getItemAsync(INSTANCE_KEY);
    return { accessToken, instanceUrl };
}

export async function clearCredentials() {
    if (Platform.OS === 'web') {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(INSTANCE_KEY);
        return;
    }
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(INSTANCE_KEY);
}

export async function getSavedAccounts(): Promise<SavedAccount[]> {
    const data = Platform.OS === 'web'
        ? localStorage.getItem(SAVED_ACCOUNTS_KEY)
        : await SecureStore.getItemAsync(SAVED_ACCOUNTS_KEY);
    return data ? JSON.parse(data) : [];
}

export async function addSavedAccount(accessToken: string, instanceUrl: string, userInfo: any) {
    const accounts = await getSavedAccounts();
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
    
    const filtered = accounts.filter(a => a.id !== id);
    filtered.push(newAccount);
    
    const data = JSON.stringify(filtered);
    if (Platform.OS === 'web') {
        localStorage.setItem(SAVED_ACCOUNTS_KEY, data);
    } else {
        await SecureStore.setItemAsync(SAVED_ACCOUNTS_KEY, data);
    }
}

export async function removeSavedAccount(id: string) {
    const accounts = await getSavedAccounts();
    const filtered = accounts.filter(a => a.id !== id);
    const data = JSON.stringify(filtered);
    
    if (Platform.OS === 'web') {
        localStorage.setItem(SAVED_ACCOUNTS_KEY, data);
    } else {
        await SecureStore.setItemAsync(SAVED_ACCOUNTS_KEY, data);
    }
}

export async function saveSetting(key: string, value: boolean) {
    const strVal = value ? 'true' : 'false';
    if (Platform.OS === 'web') {
        localStorage.setItem(key, strVal);
        return;
    }
    await SecureStore.setItemAsync(key, strVal);
}

export async function getSetting(key: string, defaultValue: boolean): Promise<boolean> {
    let val: string | null = null;
    if (Platform.OS === 'web') {
        val = localStorage.getItem(key);
    } else {
        val = await SecureStore.getItemAsync(key);
    }
    return val !== null ? val === 'true' : defaultValue;
}

export async function saveStringSetting(key: string, value: string) {
    if (Platform.OS === 'web') {
        localStorage.setItem(key, value);
        return;
    }
    await SecureStore.setItemAsync(key, value);
}

export async function getStringSetting(key: string, defaultValue: string): Promise<string> {
    let val: string | null = null;
    if (Platform.OS === 'web') {
        val = localStorage.getItem(key);
    } else {
        val = await SecureStore.getItemAsync(key);
    }
    return val !== null ? val : defaultValue;
}