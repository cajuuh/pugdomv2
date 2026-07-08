import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchHomeTimeline, fetchPublicTimeline } from '../services/mastodon/timeline';
import { Status } from '../services/mastodon/types';

type FeedType = 'home' | 'local' | 'federated';

export const useTimeline = (feedType: FeedType) => {
    return useInfiniteQuery({
        queryKey: ['timeline', feedType],
        queryFn: async ({ pageParam }) => {
            if (feedType === 'home') {
                return fetchHomeTimeline(pageParam);
            } else if (feedType === 'local') {
                return fetchPublicTimeline(pageParam, true);
            } else if (feedType === 'federated') {
                return fetchPublicTimeline(pageParam, false);
            }
            throw new Error('Invalid feed type');
        },
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage: Status[]) => {
            if (lastPage && lastPage.length > 0) {
                return lastPage[lastPage.length - 1].id;
            }
            return undefined;
        },
    });
};
