import { useInfiniteQuery } from '@tanstack/react-query';
import { AccountStatusesFilter, getAccountStatuses } from '../services/mastodon/accounts';
import { Status } from '../services/mastodon/types';

export type ProfileTab = 'posts' | 'replies' | 'media' | 'pinned';

// Posts leave out replies, Replies is everything (as on Mastodon's "Posts and replies"), Media only posts with attachments
export const PROFILE_TAB_FILTERS: Record<ProfileTab, AccountStatusesFilter> = {
    posts: { exclude_replies: true },
    replies: {},
    media: { only_media: true },
    pinned: { pinned: true },
};

// Under ['timeline'] so favourites, boosts and poll votes update these lists too (useUpdateCachedStatus)
export const accountStatusesKey = (accountId: string, tab?: ProfileTab) =>
    tab ? ['timeline', 'account', accountId, tab] : ['timeline', 'account', accountId];

export const useAccountStatuses = (accountId: string | undefined, tab: ProfileTab, enabled = true) => {
    return useInfiniteQuery({
        queryKey: accountStatusesKey(accountId ?? '', tab),
        queryFn: ({ pageParam }) => getAccountStatuses(accountId!, pageParam, PROFILE_TAB_FILTERS[tab]),
        initialPageParam: undefined as string | undefined,
        // Pinned posts come in one page (Mastodon allows 5)
        getNextPageParam: (lastPage: Status[]) =>
            tab !== 'pinned' && lastPage.length > 0 ? lastPage[lastPage.length - 1].id : undefined,
        enabled: enabled && !!accountId,
    });
};

// A profile's list for a tab, and whether the account has pinned posts (which decides if there's a Pinned tab)
export const useProfileStatuses = (accountId: string | undefined, tab: ProfileTab, enabled = true) => {
    const list = useAccountStatuses(accountId, tab, enabled);
    const pinned = useAccountStatuses(accountId, 'pinned');
    return {
        ...list,
        statuses: list.data?.pages.flat() ?? [],
        hasPinned: (pinned.data?.pages[0]?.length ?? 0) > 0,
        refetch: () => Promise.all([list.refetch(), pinned.refetch()]),
    };
};
