import { useEffect, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { search, SearchResults, SearchType } from '../services/mastodon/search';

export const ALL_LIMIT = 5;
export const PAGE_LIMIT = 20;

// The value, once it has stopped changing for `delay` ms
export const useDebounced = <T,>(value: T, delay = 300) => {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return debounced;
};

// A few of each kind, for the All tab
export const useSearchAll = (q: string, resolve: boolean) =>
    useQuery({
        queryKey: ['search', 'all', q, resolve],
        queryFn: () => search({ q, resolve, limit: ALL_LIMIT }),
        enabled: q.length > 0,
    });

// Post results live under ['timeline'] so favourites / boosts / bookmarks update them (useUpdateCachedStatus)
export const searchKey = (type: SearchType, q: string) =>
    type === 'statuses' ? ['timeline', 'search', q] : ['search', type, q];

// One kind, paged by offset
export const useSearchPage = <K extends SearchType>(type: K, q: string, enabled: boolean) =>
    useInfiniteQuery({
        queryKey: searchKey(type, q),
        queryFn: async ({ pageParam }) => (await search({ q, type, limit: PAGE_LIMIT, offset: pageParam }))[type] as SearchResults[K],
        initialPageParam: 0,
        getNextPageParam: (lastPage: SearchResults[K], pages: SearchResults[K][]) =>
            lastPage.length < PAGE_LIMIT ? undefined : pages.reduce((count, page) => count + page.length, 0),
        enabled: enabled && q.length > 0,
    });
