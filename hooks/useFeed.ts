import { useCallback } from 'react';
import { InfiniteData, useInfiniteQuery } from '@tanstack/react-query';
import { FeedDescriptor } from '../services/mastodon/feedTypes';
import { fetchFeedPage, withoutDirect } from '../services/mastodon/feedService';
import { Status } from '../services/mastodon/types';

// Filtered for display only, so each page keeps its last post as the cursor for the next.
// `shows` hides more (Home without boosts or replies); keep it the same function between renders.
export const useFeed = (feed: FeedDescriptor, shows?: (post: Status) => boolean) => {
    const select = useCallback((data: InfiniteData<Status[], string | undefined>) => ({
        ...data,
        pages: data.pages.map(page => (shows ? withoutDirect(page).filter(shows) : withoutDirect(page))),
    }), [shows]);
    const query = useInfiniteQuery({
        queryKey: ['timeline', feed.id],
        queryFn: async ({ pageParam }) => {
            return fetchFeedPage(feed, pageParam);
        },
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage: Status[], allPages: Status[][]) => {
            if (!lastPage || lastPage.length === 0) return undefined;

            if (feed.kind === 'trending') {
                if (lastPage.length >= 20) {
                    const totalLoaded = allPages.reduce((acc, p) => acc + p.length, 0);
                    return `offset:${totalLoaded}`;
                }
                return undefined;
            }

            return lastPage[lastPage.length - 1].id;
        },
        select,
    });

    // Loading more joins a reload in progress instead of cancelling it (TanStack cancels by default). The
    // new posts pill cuts the list to its first page and reloads it; scrolled down, that short list asks
    // for more at once, which cancelled the reload and left the pill on top of the old posts.
    const fetchNextPage = useCallback(() => query.fetchNextPage({ cancelRefetch: false }), [query.fetchNextPage]);
    return { ...query, fetchNextPage };
};
