import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchCustomEmojis } from '../services/mastodon/customEmojis';
import { loadCachedEmojis, saveCachedEmojis } from '../services/emojiCache';
import { getCredentials } from '../services/storage';

export const CUSTOM_EMOJIS_KEY = ['customEmojis'];
export const EMOJI_STALE_TIME = 60 * 60 * 1000;

// Fetches the active server's emoji and remembers them, so the next launch has them at once
export const fetchAndCacheEmojis = async () => {
    const emojis = await fetchCustomEmojis();
    try {
        const { instanceUrl } = await getCredentials();
        if (instanceUrl) await saveCachedEmojis(instanceUrl, emojis);
    } catch {
        // Not being able to store them only costs a refetch next time
    }
    return emojis;
};

export const useCustomEmojis = (enabled: boolean) =>
    useQuery({
        queryKey: CUSTOM_EMOJIS_KEY,
        queryFn: fetchAndCacheEmojis,
        staleTime: EMOJI_STALE_TIME,
        enabled,
    });

// On launch and after switching accounts, load the server's stored emoji into the query cache
// (the cache is cleared on account changes), then refresh them in the background once they're stale
export const useEmojiCachePrimer = (accountId: string | undefined) => {
    const queryClient = useQueryClient();
    useEffect(() => {
        if (!accountId) return;
        let cancelled = false;
        (async () => {
            const { instanceUrl } = await getCredentials();
            if (!instanceUrl || cancelled) return;
            const cached = await loadCachedEmojis(instanceUrl);
            if (cancelled) return;
            if (cached) {
                queryClient.setQueryData(CUSTOM_EMOJIS_KEY, cached.emojis, { updatedAt: cached.savedAt });
            }
            queryClient
                .prefetchQuery({ queryKey: CUSTOM_EMOJIS_KEY, queryFn: fetchAndCacheEmojis, staleTime: EMOJI_STALE_TIME })
                .catch(() => {});
        })().catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [accountId, queryClient]);
};
