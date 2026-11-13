import { useCallback, useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { FeedType, NEW_POSTS_LIMIT } from '../services/mastodon/timeline';
import { FeedDescriptor } from '../services/mastodon/feedTypes';
import { fetchFeedNewer, withoutDirect } from '../services/mastodon/feedService';
import { Account, Status } from '../services/mastodon/types';

export const NEW_POSTS_INTERVAL_MS = 3 * 60_000;

// Holds the posts newer than `newestId` the server sent (or the stream brought)
export const newPostsKey = (feedId: string, newestId: string | undefined) => ['newPosts', feedId, newestId];

export interface NewPosts {
    count: number;
    // The server returned a full page, so there may be more ("40+")
    more: boolean;
    // Up to three different authors, for the pill's avatars
    accounts: Account[];
}

const NONE: NewPosts = { count: 0, more: false, accounts: [] };

// Direct posts don't count, nor what `shows` hides: the timeline doesn't show them
export const summarizeNewPosts = (fetched: Status[], shows?: (post: Status) => boolean): NewPosts => {
    const posts = shows ? withoutDirect(fetched).filter(shows) : withoutDirect(fetched);
    const accounts: Account[] = [];
    for (const post of posts) {
        if (accounts.length < 3 && !accounts.some(a => a.id === post.account.id)) accounts.push(post.account);
    }
    return { count: posts.length, more: fetched.length >= NEW_POSTS_LIMIT, accounts };
};

// Checks for posts newer than the top of the list every three minutes while the app is in the foreground.
// Not under ['timeline']: those queries are paged lists that useUpdateCachedStatus rewrites.
// Only pause in the background: at launch the state can still be 'unknown'
const isForeground = (state: AppStateStatus | null) => state !== 'background';

// `checking` is off for a feed kept mounted behind the one on screen
export const useNewPosts = (feed: FeedType | FeedDescriptor, newestId: string | undefined, checking = true, shows?: (post: Status) => boolean): NewPosts => {
    const [active, setActive] = useState(isForeground(AppState.currentState));
    const descriptor: FeedDescriptor = typeof feed === 'string' ? { id: feed, kind: feed } : feed;

    useEffect(() => {
        const subscription = AppState.addEventListener('change', state => setActive(isForeground(state)));
        return () => subscription.remove();
    }, []);

    const select = useCallback((fetched: Status[]) => summarizeNewPosts(fetched, shows), [shows]);

    const { data } = useQuery({
        queryKey: newPostsKey(descriptor.id, newestId),
        queryFn: () => fetchFeedNewer(descriptor, newestId!),
        enabled: !!newestId && active && checking && descriptor.kind !== 'trending',
        // The list was just loaded, so the first check waits a full interval
        initialData: [],
        initialDataUpdatedAt: () => Date.now(),
        staleTime: NEW_POSTS_INTERVAL_MS,
        refetchInterval: active && checking ? NEW_POSTS_INTERVAL_MS : false,
        select,
    });

    return data ?? NONE;
};
