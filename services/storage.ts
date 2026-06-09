import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'pugdom_access_token';
const INSTANCE_KEY = 'pugdom_instance_url';

export interface Credentials {
    accessToken: string | null;
    instanceUrl: string | null;
}

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