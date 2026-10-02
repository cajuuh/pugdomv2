import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'react-native';
import { CustomEmoji } from './mastodon/types';

// Custom emoji belong to a server, not an account, so they're stored per instance
const KEY_PREFIX = 'pugdom_custom_emojis_';

export interface CachedEmojis {
    emojis: CustomEmoji[];
    savedAt: number;
}

export const emojiCacheKey = (instanceUrl: string) =>
    KEY_PREFIX + instanceUrl.replace(/^https?:\/\//i, '').replace(/\/+$/, '').toLowerCase();

export async function loadCachedEmojis(instanceUrl: string): Promise<CachedEmojis | null> {
    try {
        const raw = await AsyncStorage.getItem(emojiCacheKey(instanceUrl));
        if (!raw) return null;
        const cached = JSON.parse(raw) as CachedEmojis;
        return Array.isArray(cached.emojis) ? cached : null;
    } catch {
        return null;
    }
}

export async function saveCachedEmojis(instanceUrl: string, emojis: CustomEmoji[], now = Date.now()) {
    // Only what the picker and post rendering use, to keep the stored value small
    const slim = emojis.map(({ shortcode, url, static_url, visible_in_picker, category }) => ({
        shortcode,
        url,
        static_url,
        visible_in_picker,
        category,
    }));
    await AsyncStorage.setItem(emojiCacheKey(instanceUrl), JSON.stringify({ emojis: slim, savedAt: now }));
}

// Downloads the picker's emoji images into the image cache a few at a time, reporting how many are done.
// Failed images are skipped: the picker just loads them later.
export async function prefetchEmojiImages(
    emojis: CustomEmoji[],
    onProgress?: (done: number, total: number) => void,
    concurrency = 8
) {
    const urls = emojis.filter(emoji => emoji.visible_in_picker).map(emoji => emoji.static_url || emoji.url);
    let done = 0;
    let next = 0;
    onProgress?.(0, urls.length);
    const worker = async () => {
        while (next < urls.length) {
            const url = urls[next++];
            try {
                await Image.prefetch(url);
            } catch {
                // keep going
            }
            onProgress?.(++done, urls.length);
        }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
}
