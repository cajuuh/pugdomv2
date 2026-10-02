import { useInfiniteQuery } from '@tanstack/react-query';
import { getBookmarks } from '../services/mastodon/bookmarks';

// Under ['timeline'] so favourites, boosts, bookmarks and poll votes update this list too (useUpdateCachedStatus)
export const BOOKMARKS_KEY = ['timeline', 'bookmarks'];

export const useBookmarks = (enabled: boolean) => {
    return useInfiniteQuery({
        queryKey: BOOKMARKS_KEY,
        queryFn: ({ pageParam }) => getBookmarks(pageParam),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: lastPage => (lastPage.statuses.length > 0 ? lastPage.nextMaxId : undefined),
        enabled,
    });
};
