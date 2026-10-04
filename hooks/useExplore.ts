import { useCallback } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    getLinkTimeline,
    getSuggestions,
    getTrendingLinks,
    getTrendingStatuses,
    getTrendingTags,
    TrendLink,
} from '../services/mastodon/trends';
import { Tag } from '../services/mastodon/tags';
import { Account, Status } from '../services/mastodon/types';
import {
    addRecentSearch,
    clearRecentSearches,
    getRecentSearches,
    removeRecentSearch,
} from '../services/recentSearches';

export const trendingStatusesKey = () => ['timeline', 'trending'];
export const trendingTagsKey = () => ['trends', 'tags'];
export const trendingLinksKey = () => ['trends', 'links'];
export const suggestionsKey = () => ['suggestions'];
export const linkTimelineKey = (url: string) => ['timeline', 'link', url];
export const recentSearchesKey = (accountId?: string) => ['recentSearches', accountId || 'default'];

export const useTrendingStatuses = (enabled = true) =>
    useInfiniteQuery({
        queryKey: trendingStatusesKey(),
        queryFn: ({ pageParam }) => getTrendingStatuses(20, pageParam),
        initialPageParam: 0,
        getNextPageParam: (lastPage: Status[], allPages) =>
            lastPage.length === 20 ? allPages.length * 20 : undefined,
        enabled,
    });

export const useTrendingTags = (enabled = true) =>
    useInfiniteQuery({
        queryKey: trendingTagsKey(),
        queryFn: ({ pageParam }) => getTrendingTags(10, pageParam),
        initialPageParam: 0,
        getNextPageParam: (lastPage: Tag[], allPages) =>
            lastPage.length === 10 ? allPages.length * 10 : undefined,
        enabled,
    });

export const useTrendingLinks = (enabled = true) =>
    useInfiniteQuery({
        queryKey: trendingLinksKey(),
        queryFn: ({ pageParam }) => getTrendingLinks(10, pageParam),
        initialPageParam: 0,
        getNextPageParam: (lastPage: TrendLink[], allPages) =>
            lastPage.length === 10 ? allPages.length * 10 : undefined,
        enabled,
    });

export const useSuggestions = (enabled = true) =>
    useQuery<Account[]>({
        queryKey: suggestionsKey(),
        queryFn: () => getSuggestions(30),
        enabled,
    });

export const useLinkTimeline = (url: string, enabled = true) =>
    useInfiniteQuery({
        queryKey: linkTimelineKey(url),
        queryFn: ({ pageParam }) => getLinkTimeline(url, pageParam),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage: Status[]) =>
            lastPage.length > 0 ? lastPage[lastPage.length - 1].id : undefined,
        enabled: enabled && !!url,
    });

export const useRecentSearches = (accountId?: string) => {
    const queryClient = useQueryClient();
    const key = recentSearchesKey(accountId);

    const query = useQuery<string[]>({
        queryKey: key,
        queryFn: () => getRecentSearches(accountId),
    });

    const add = useCallback(
        async (term: string) => {
            const updated = await addRecentSearch(term, accountId);
            queryClient.setQueryData<string[]>(key, updated);
        },
        [queryClient, key, accountId]
    );

    const remove = useCallback(
        async (term: string) => {
            const updated = await removeRecentSearch(term, accountId);
            queryClient.setQueryData<string[]>(key, updated);
        },
        [queryClient, key, accountId]
    );

    const clear = useCallback(async () => {
        await clearRecentSearches(accountId);
        queryClient.setQueryData<string[]>(key, []);
    }, [queryClient, key, accountId]);

    return {
        searches: query.data ?? [],
        isLoading: query.isLoading,
        add,
        remove,
        clear,
    };
};
