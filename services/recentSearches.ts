import AsyncStorage from '@react-native-async-storage/async-storage';

export const MAX_RECENT_SEARCHES = 10;
export const recentSearchKey = (accountId?: string) => `pugdom_recent_searches_${accountId || 'default'}`;

export async function getRecentSearches(accountId?: string): Promise<string[]> {
    try {
        const raw = await AsyncStorage.getItem(recentSearchKey(accountId));
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];
    } catch {
        return [];
    }
}

export async function addRecentSearch(query: string, accountId?: string): Promise<string[]> {
    const trimmed = query.trim();
    if (!trimmed) return getRecentSearches(accountId);
    try {
        const current = await getRecentSearches(accountId);
        // Case-insensitive deduplication: remove previous occurrences
        const filtered = current.filter(item => item.toLowerCase() !== trimmed.toLowerCase());
        const updated = [trimmed, ...filtered].slice(0, MAX_RECENT_SEARCHES);
        await AsyncStorage.setItem(recentSearchKey(accountId), JSON.stringify(updated));
        return updated;
    } catch {
        return [trimmed];
    }
}

export async function removeRecentSearch(query: string, accountId?: string): Promise<string[]> {
    const trimmed = query.trim();
    try {
        const current = await getRecentSearches(accountId);
        const updated = current.filter(item => item.toLowerCase() !== trimmed.toLowerCase());
        await AsyncStorage.setItem(recentSearchKey(accountId), JSON.stringify(updated));
        return updated;
    } catch {
        return [];
    }
}

export async function clearRecentSearches(accountId?: string): Promise<void> {
    try {
        await AsyncStorage.removeItem(recentSearchKey(accountId));
    } catch {
        // ignore
    }
}
