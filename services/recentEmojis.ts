import AsyncStorage from '@react-native-async-storage/async-storage';

// Two rows of the picker
export const MAX_RECENT_EMOJIS = 14;
export const recentEmojiKey = (accountId?: string) => `pugdom_recent_emojis_${accountId || 'default'}`;

// Shortcodes of the custom emoji you used last, newest first
export async function getRecentEmojis(accountId?: string): Promise<string[]> {
    try {
        const raw = await AsyncStorage.getItem(recentEmojiKey(accountId));
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string' && item.length > 0) : [];
    } catch {
        return [];
    }
}

export async function addRecentEmoji(shortcode: string, accountId?: string): Promise<string[]> {
    try {
        const current = await getRecentEmojis(accountId);
        const updated = [shortcode, ...current.filter(item => item !== shortcode)].slice(0, MAX_RECENT_EMOJIS);
        await AsyncStorage.setItem(recentEmojiKey(accountId), JSON.stringify(updated));
        return updated;
    } catch {
        return [shortcode];
    }
}
