import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../services/authContext';
import {
    getPinnedFeeds,
    pinFeed as pinFeedStorage,
    unpinFeed as unpinFeedStorage,
    getCustomFeeds,
    saveCustomFeed as saveCustomFeedStorage,
    deleteCustomFeed as deleteCustomFeedStorage,
    replaceCustomFeed as replaceCustomFeedStorage,
    isFeedPinned,
    savePinnedFeeds,
    updatePinnedFeed as updatePinnedFeedStorage,
} from '../services/pinnedFeeds';
import { getFollowedTags, Tag, unfollowTag } from '../services/mastodon/tags';
import { DEFAULT_PINNED_FEEDS, FeedDescriptor } from '../services/mastodon/feedTypes';
import { tagKey } from './useTag';

export const usePinnedFeeds = () => {
    const { user } = useAuth();
    const accountId = user?.id ?? 'default';
    const queryClient = useQueryClient();

    const pinnedQuery = useQuery({
        queryKey: ['pinnedFeeds', accountId],
        queryFn: () => getPinnedFeeds(accountId),
        // Shown until the saved pins load; placeholder, so they always do load
        placeholderData: DEFAULT_PINNED_FEEDS,
    });

    const customFeedsQuery = useQuery({
        queryKey: ['customFeeds', accountId],
        queryFn: () => getCustomFeeds(accountId),
        placeholderData: [],
    });

    const followedTagsQuery = useQuery({
        queryKey: ['followedTags', accountId],
        queryFn: () => getFollowedTags(100),
        enabled: !!user?.id,
    });

    const pinMutation = useMutation({
        mutationFn: (feed: FeedDescriptor) => pinFeedStorage(accountId, feed),
        onSuccess: (updated) => {
            queryClient.setQueryData(['pinnedFeeds', accountId], updated);
        },
    });

    const unpinMutation = useMutation({
        mutationFn: (feedId: string) => unpinFeedStorage(accountId, feedId),
        onSuccess: (updated) => {
            queryClient.setQueryData(['pinnedFeeds', accountId], updated);
        },
    });

    // A pinned feed's details changed (a renamed list): keep its pill up to date
    const updatePinnedMutation = useMutation({
        mutationFn: (feed: FeedDescriptor) => updatePinnedFeedStorage(accountId, feed),
        onSuccess: (updated) => {
            queryClient.setQueryData(['pinnedFeeds', accountId], updated);
        },
    });

    // Shown right away, so each arrow tap builds on the last one. A read still under way would bring the old order back.
    const reorderMutation = useMutation({
        mutationFn: (feeds: FeedDescriptor[]) => savePinnedFeeds(accountId, feeds),
        onMutate: async (feeds) => {
            await queryClient.cancelQueries({ queryKey: ['pinnedFeeds', accountId] });
            queryClient.setQueryData(['pinnedFeeds', accountId], feeds);
        },
    });

    const unfollowHashtagMutation = useMutation({
        mutationFn: (name: string) => unfollowTag(name),
        onSuccess: (_, name) => {
            queryClient.setQueryData<Tag[]>(['followedTags', accountId], tags => tags?.filter(tag => tag.name !== name));
            queryClient.setQueryData<Tag>(tagKey(name), tag => tag && { ...tag, following: false });
        },
    });

    const addCustomFeedMutation = useMutation({
        mutationFn: async (feed: FeedDescriptor) => {
            await saveCustomFeedStorage(accountId, feed);
            return pinFeedStorage(accountId, feed);
        },
        onSuccess: (pinnedUpdated) => {
            queryClient.invalidateQueries({ queryKey: ['customFeeds', accountId] });
            queryClient.setQueryData(['pinnedFeeds', accountId], pinnedUpdated);
        },
    });

    const replaceCustomFeedMutation = useMutation({
        mutationFn: ({ oldId, feed }: { oldId: string; feed: FeedDescriptor }) => replaceCustomFeedStorage(accountId, oldId, feed),
        onSuccess: (pinnedUpdated) => {
            queryClient.invalidateQueries({ queryKey: ['customFeeds', accountId] });
            queryClient.setQueryData(['pinnedFeeds', accountId], pinnedUpdated);
        },
    });

    const removeCustomFeedMutation = useMutation({
        mutationFn: async (feedId: string) => {
            return deleteCustomFeedStorage(accountId, feedId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customFeeds', accountId] });
            queryClient.invalidateQueries({ queryKey: ['pinnedFeeds', accountId] });
        },
    });

    return {
        pinnedFeeds: pinnedQuery.data ?? DEFAULT_PINNED_FEEDS,
        customFeeds: customFeedsQuery.data ?? [],
        followedTags: followedTagsQuery.data ?? [],
        isLoading: pinnedQuery.isLoading,
        pinFeed: pinMutation.mutateAsync,
        unpinFeed: unpinMutation.mutateAsync,
        updatePinnedFeed: updatePinnedMutation.mutateAsync,
        // Moves a pinned feed by `offset` places in the cached order as it is now, not as the caller last
        // rendered it: a second arrow tap can land before the re-render. Written to the cache before the
        // mutation starts, since its onMutate waits on cancelQueries first
        movePinnedFeed: (feedId: string, offset: number) => {
            const feeds = [...(queryClient.getQueryData<FeedDescriptor[]>(['pinnedFeeds', accountId]) ?? DEFAULT_PINNED_FEEDS)];
            const from = feeds.findIndex(feed => feed.id === feedId);
            const to = Math.max(0, Math.min(feeds.length - 1, from + offset));
            if (from < 0 || from === to) return Promise.resolve();
            feeds.splice(to, 0, ...feeds.splice(from, 1));
            queryClient.setQueryData(['pinnedFeeds', accountId], feeds);
            return reorderMutation.mutateAsync(feeds);
        },
        unfollowHashtag: unfollowHashtagMutation.mutateAsync,
        addCustomFeed: addCustomFeedMutation.mutateAsync,
        replaceCustomFeed: replaceCustomFeedMutation.mutateAsync,
        removeCustomFeed: removeCustomFeedMutation.mutateAsync,
        isPinned: (feedId: string) => isFeedPinned(pinnedQuery.data ?? DEFAULT_PINNED_FEEDS, feedId),
    };
};
