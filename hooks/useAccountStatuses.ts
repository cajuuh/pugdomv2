import { useInfiniteQuery } from '@tanstack/react-query';
import { AccountStatusesFilter, getAccountStatuses } from '../services/mastodon/accounts';
import { Status } from '../services/mastodon/types';

export type ProfileTab = 'posts' | 'replies' | 'media';

// Posts leave out replies, Replies is everything (as on Mastodon's "Posts and replies"), Media only posts with attachments
export const PROFILE_TAB_FILTERS: Record<ProfileTab, AccountStatusesFilter> = {
    posts: { exclude_replies: true },
    replies: {},
    media: { only_media: true },
};

// Under ['timeline'] so favourites, boosts and poll votes update these lists too (useUpdateCachedStatus)
export const accountStatusesKey = (accountId: string, tab?: ProfileTab) =>
    tab ? ['timeline', 'account', accountId, tab] : ['timeline', 'account', accountId];

export const useAccountStatuses = (accountId: string | undefined, tab: ProfileTab) => {
    return useInfiniteQuery({
        queryKey: accountStatusesKey(accountId ?? '', tab),
        queryFn: ({ pageParam }) => getAccountStatuses(accountId!, pageParam, PROFILE_TAB_FILTERS[tab]),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage: Status[]) =>
            lastPage.length > 0 ? lastPage[lastPage.length - 1].id : undefined,
        enabled: !!accountId,
    });
};
