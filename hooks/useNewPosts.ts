import { useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { FeedType, fetchNewerPosts, NEW_POSTS_LIMIT } from '../services/mastodon/timeline';
import { Account, Status } from '../services/mastodon/types';

export const NEW_POSTS_INTERVAL_MS = 60_000;

export interface NewPosts {
    count: number;
    // The server returned a full page, so there may be more ("40+")
    more: boolean;
    // Up to three different authors, for the pill's avatars
    accounts: Account[];
}

const NONE: NewPosts = { count: 0, more: false, accounts: [] };

export const summarizeNewPosts = (posts: Status[]): NewPosts => {
    const accounts: Account[] = [];
    for (const post of posts) {
        if (accounts.length < 3 && !accounts.some(a => a.id === post.account.id)) accounts.push(post.account);
    }
    return { count: posts.length, more: posts.length >= NEW_POSTS_LIMIT, accounts };
};

// Checks for posts newer than the top of the list every minute while the app is in the foreground.
// Not under ['timeline']: those queries are paged lists that useUpdateCachedStatus rewrites.
// Only pause in the background: at launch the state can still be 'unknown'
const isForeground = (state: AppStateStatus | null) => state !== 'background';

export const useNewPosts = (feed: FeedType, newestId: string | undefined): NewPosts => {
    const [active, setActive] = useState(isForeground(AppState.currentState));

    useEffect(() => {
        const subscription = AppState.addEventListener('change', state => setActive(isForeground(state)));
        return () => subscription.remove();
    }, []);

    const { data } = useQuery({
        queryKey: ['newPosts', feed, newestId],
        queryFn: () => fetchNewerPosts(feed, newestId!),
        enabled: !!newestId && active,
        // The list was just loaded, so the first check waits a full interval
        initialData: [],
        initialDataUpdatedAt: () => Date.now(),
        staleTime: NEW_POSTS_INTERVAL_MS,
        refetchInterval: active ? NEW_POSTS_INTERVAL_MS : false,
        select: summarizeNewPosts,
    });

    return data ?? NONE;
};
