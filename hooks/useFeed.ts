import { InfiniteData, useInfiniteQuery } from '@tanstack/react-query';
import { FeedDescriptor } from '../services/mastodon/feedTypes';
import { fetchFeedPage, withoutDirect } from '../services/mastodon/feedService';
import { Status } from '../services/mastodon/types';

// Filtered for display only, so each page keeps its last post as the cursor for the next
const hideDirect = (data: InfiniteData<Status[], string | undefined>) => ({ ...data, pages: data.pages.map(withoutDirect) });

export const useFeed = (feed: FeedDescriptor) => {
    return useInfiniteQuery({
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
        select: hideDirect,
    });
};
