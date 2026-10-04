import { useInfiniteQuery } from '@tanstack/react-query';
import { FeedDescriptor } from '../services/mastodon/feedTypes';
import { fetchFeedPage } from '../services/mastodon/feedService';
import { Status } from '../services/mastodon/types';

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
    });
};
