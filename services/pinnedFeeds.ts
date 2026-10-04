import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_PINNED_FEEDS, FeedDescriptor } from './mastodon/feedTypes';

const PINNED_STORAGE_PREFIX = 'pugdom_pinned_feeds_';
const CUSTOM_STORAGE_PREFIX = 'pugdom_custom_feeds_';

export const getPinnedStorageKey = (accountId: string) => `${PINNED_STORAGE_PREFIX}${accountId || 'default'}`;
export const getCustomStorageKey = (accountId: string) => `${CUSTOM_STORAGE_PREFIX}${accountId || 'default'}`;

export async function getPinnedFeeds(accountId: string): Promise<FeedDescriptor[]> {
    try {
        const raw = await AsyncStorage.getItem(getPinnedStorageKey(accountId));
        if (!raw) return DEFAULT_PINNED_FEEDS;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_PINNED_FEEDS;

        // Ensure home feed is always present and cannot be lost
        const hasHome = parsed.some(f => f.id === 'home');
        if (!hasHome) {
            return [DEFAULT_PINNED_FEEDS[0], ...parsed];
        }
        return parsed;
    } catch {
        return DEFAULT_PINNED_FEEDS;
    }
}

export async function savePinnedFeeds(accountId: string, feeds: FeedDescriptor[]): Promise<void> {
    try {
        // Ensure home is never removed
        const withHome = feeds.some(f => f.id === 'home') ? feeds : [DEFAULT_PINNED_FEEDS[0], ...feeds];
        await AsyncStorage.setItem(getPinnedStorageKey(accountId), JSON.stringify(withHome));
    } catch {
        // storage errors fail quietly
    }
}

export async function pinFeed(accountId: string, feed: FeedDescriptor): Promise<FeedDescriptor[]> {
    const current = await getPinnedFeeds(accountId);
    if (current.some(f => f.id === feed.id)) return current;
    const updated = [...current, feed];
    await savePinnedFeeds(accountId, updated);
    return updated;
}

export async function unpinFeed(accountId: string, feedId: string): Promise<FeedDescriptor[]> {
    if (feedId === 'home') return getPinnedFeeds(accountId);
    const current = await getPinnedFeeds(accountId);
    const updated = current.filter(f => f.id !== feedId);
    await savePinnedFeeds(accountId, updated);
    return updated;
}

export const isFeedPinned = (pinnedList: FeedDescriptor[], feedId: string): boolean => {
    return pinnedList.some(f => f.id === feedId);
};

export async function getCustomFeeds(accountId: string): Promise<FeedDescriptor[]> {
    try {
        const raw = await AsyncStorage.getItem(getCustomStorageKey(accountId));
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export async function saveCustomFeed(accountId: string, feed: FeedDescriptor): Promise<FeedDescriptor[]> {
    const current = await getCustomFeeds(accountId);
    const filtered = current.filter(f => f.id !== feed.id);
    const updated = [...filtered, feed];
    try {
        await AsyncStorage.setItem(getCustomStorageKey(accountId), JSON.stringify(updated));
    } catch {
        // ignore
    }
    return updated;
}

export async function deleteCustomFeed(accountId: string, feedId: string): Promise<FeedDescriptor[]> {
    const current = await getCustomFeeds(accountId);
    const updated = current.filter(f => f.id !== feedId);
    try {
        await AsyncStorage.setItem(getCustomStorageKey(accountId), JSON.stringify(updated));
    } catch {
        // ignore
    }
    // Also unpin if it was pinned
    await unpinFeed(accountId, feedId);
    return updated;
}
