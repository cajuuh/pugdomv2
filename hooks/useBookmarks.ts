import { useInfiniteQuery } from '@tanstack/react-query';
import { getBookmarks, getFavourites } from '../services/mastodon/bookmarks';

// Lists only you see: what you saved, and what you favourited
export type OwnList = 'bookmarks' | 'favourites';

// Under ['timeline'] so favourites, boosts, bookmarks and poll votes update these lists too (useUpdateCachedStatus)
export const BOOKMARKS_KEY = ['timeline', 'bookmarks'];
export const FAVOURITES_KEY = ['timeline', 'favourites'];

export const useOwnList = (list: OwnList, enabled: boolean) => {
    return useInfiniteQuery({
        queryKey: list === 'bookmarks' ? BOOKMARKS_KEY : FAVOURITES_KEY,
        queryFn: ({ pageParam }) => (list === 'bookmarks' ? getBookmarks : getFavourites)(pageParam),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: lastPage => (lastPage.statuses.length > 0 ? lastPage.nextMaxId : undefined),
        enabled,
    });
};
