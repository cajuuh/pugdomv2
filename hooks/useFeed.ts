import { useCallback, useMemo, useState } from 'react';
import { InfiniteData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { FeedDescriptor } from '../services/mastodon/feedTypes';
import { canPageById, fetchFeedPage, fetchFeedRange } from '../services/mastodon/feedService';
import { afterLoad, compareIds, feedItems, Gap, GapEnd, GAP_LIMIT, gapRange, Gaps, insertAfter, newestFirst, prepend, restoreHome } from '../services/mastodon/timelineGaps';
import { Status } from '../services/mastodon/types';
import { getSetting } from '../services/storage';
import { newPostsKey } from './useNewPosts';
import { KEEP_PLACE_KEY } from '../services/settingsContext';

type Pages = InfiniteData<Status[], string | undefined>;

const keepPlaceSaved = async () => {
    try {
        return await getSetting(KEEP_PLACE_KEY, false);
    } catch {
        return false;
    }
};

// Pages keep every post the server sent, so each one's last post is the cursor for the next. `items` is
// what to draw: direct posts and what `shows` hides (Home without boosts or replies) left out, gap rows
// put in. Keep `shows` the same function between renders.
// `keepPlace` (a setting): new posts go on top with a gap under them, instead of a reload from the newest
export const useFeed = (feed: FeedDescriptor, shows?: (post: Status) => boolean, keepPlace = false) => {
    const queryClient = useQueryClient();
    const key = useMemo(() => ['timeline', feed.id], [feed.id]);
    const [gaps, setGaps] = useState<Gaps>({});
    // Home reopened where you left it: the post to start on
    const [restoredTo, setRestoredTo] = useState<string>();

    const query = useInfiniteQuery({
        queryKey: key,
        queryFn: async ({ pageParam }) => {
            // Home's first load (per account) opens where you left it. Read from storage: the settings
            // may still be loading.
            if (feed.kind === 'home' && pageParam === undefined && !queryClient.getQueryData(key) && (await keepPlaceSaved())) {
                const restored = await restoreHome().catch(() => null);
                if (restored) {
                    setGaps(restored.gaps);
                    setRestoredTo(restored.anchor);
                    return restored.posts;
                }
            }
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

    const posts = useMemo(() => query.data?.pages.flat() ?? [], [query.data]);
    const items = useMemo(
        () => feedItems(posts, gaps, post => post.visibility !== 'direct' && (!shows || shows(post))),
        [posts, gaps, shows]
    );

    // Loading more joins a reload in progress instead of cancelling it (TanStack cancels by default). The
    // new posts pill on Trending cuts the list to its first page and reloads it; scrolled down, that short
    // list asks for more at once, which cancelled the reload and left the pill on top of the old posts.
    const fetchNextPage = useCallback(() => query.fetchNextPage({ cancelRefetch: false }), [query.fetchNextPage]);

    // The newest posts on top. More than a page leaves a gap under them, so what's loaded stays.
    // Without keepPlace, the list is cut to its first page and reloaded. Gives the newest post's id.
    const loadNewest = useCallback(async (): Promise<string | undefined> => {
        const top = queryClient.getQueryData<Pages>(key)?.pages[0]?.[0];
        if (!top || !keepPlace || !canPageById(feed)) {
            queryClient.setQueryData<Pages>(key, current => current && { pages: current.pages.slice(0, 1), pageParams: current.pageParams.slice(0, 1) });
            const { data } = await query.refetch();
            return data?.pages[0]?.[0]?.id;
        }
        const fetched = await fetchFeedRange(feed, { since_id: top.id, limit: GAP_LIMIT });
        if (!fetched.length) return top.id;
        queryClient.setQueryData<Pages>(key, current => current && { ...current, pages: prepend(current.pages, fetched) });
        const sorted = newestFirst(fetched);
        if (fetched.length >= GAP_LIMIT) setGaps(current => ({ ...current, [sorted[sorted.length - 1].id]: top.id }));
        return sorted[0].id;
    }, [queryClient, key, feed, keepPlace, query.refetch]);

    // Posts into a gap from one end. Throws when the server can't be reached.
    const [loadingGap, setLoadingGap] = useState<string | null>(null);
    const loadGap = useCallback(async (gap: Gap, from: GapEnd) => {
        setLoadingGap(gap.id);
        try {
            const fetched = await fetchFeedRange(feed, gapRange(gap, from));
            queryClient.setQueryData<Pages>(key, current => current && { ...current, pages: insertAfter(current.pages, gap.above, fetched) });
            setGaps(current => afterLoad(current, gap, fetched, from));
            return newestFirst(fetched);
        } finally {
            setLoadingGap(null);
        }
    }, [queryClient, key, feed]);

    // Posts that arrived live: on the list when you're at its top, else counted in the new posts pill,
    // so the list doesn't move while you read
    const addStreamed = useCallback((streamed: Status[], atTop: boolean) => {
        const top = queryClient.getQueryData<Pages>(key)?.pages[0]?.[0];
        const newer = top ? streamed.filter(post => compareIds(post.id, top.id) > 0) : [];
        if (!top || !newer.length) return;
        if (atTop) {
            queryClient.setQueryData<Pages>(key, current => current && { ...current, pages: prepend(current.pages, newer) });
            return;
        }
        queryClient.setQueryData<Status[]>(newPostsKey(feed.id, top.id), waiting => {
            const byId = new Map([...(waiting ?? []), ...newer].map(post => [post.id, post]));
            // A full page reads "40+"
            return newestFirst([...byId.values()]).slice(0, GAP_LIMIT);
        });
    }, [queryClient, key, feed.id]);

    return { ...query, fetchNextPage, posts, items, restoredTo, loadNewest, loadGap, loadingGap, addStreamed };
};
