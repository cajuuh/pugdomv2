import { useCallback } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { followTag, getTag, getTagTimeline, Tag, TagTimelineOptions, unfollowTag } from '../services/mastodon/tags';
import { Status } from '../services/mastodon/types';

const tagKey = (name: string) => ['tag', name.toLowerCase()];

// Under ['timeline'] so favourites, boosts, bookmarks and votes update it (useUpdateCachedStatus)
export const tagTimelineKey = (tag: string) => ['timeline', 'tag', tag.toLowerCase()];

export const useTag = (name: string) =>
    useQuery({ queryKey: tagKey(name), queryFn: () => getTag(name) });

export const useTagTimeline = (tag: string, options?: TagTimelineOptions) =>
    useInfiniteQuery({
        queryKey: tagTimelineKey(tag),
        queryFn: ({ pageParam }) => getTagTimeline(tag, pageParam, options),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage: Status[]) => (lastPage.length > 0 ? lastPage[lastPage.length - 1].id : undefined),
    });

// Follows or unfollows a hashtag, showing the change right away and undoing it if the request fails
export const useToggleFollowTag = (name: string) => {
    const queryClient = useQueryClient();
    return useCallback(async (follow: boolean) => {
        const key = tagKey(name);
        const previous = queryClient.getQueryData<Tag>(key);
        queryClient.setQueryData<Tag>(key, current => current && { ...current, following: follow });
        try {
            queryClient.setQueryData(key, await (follow ? followTag(name) : unfollowTag(name)));
        } catch (error) {
            queryClient.setQueryData(key, previous);
            throw error;
        }
    }, [queryClient, name]);
};
