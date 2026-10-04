import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../services/authContext';
import {
    getPinnedFeeds,
    pinFeed as pinFeedStorage,
    unpinFeed as unpinFeedStorage,
    getCustomFeeds,
    saveCustomFeed as saveCustomFeedStorage,
    deleteCustomFeed as deleteCustomFeedStorage,
    isFeedPinned,
    updatePinnedFeed as updatePinnedFeedStorage,
} from '../services/pinnedFeeds';
import { getFollowedTags } from '../services/mastodon/tags';
import { DEFAULT_PINNED_FEEDS, FeedDescriptor } from '../services/mastodon/feedTypes';

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
        addCustomFeed: addCustomFeedMutation.mutateAsync,
        removeCustomFeed: removeCustomFeedMutation.mutateAsync,
        isPinned: (feedId: string) => isFeedPinned(pinnedQuery.data ?? DEFAULT_PINNED_FEEDS, feedId),
    };
};
