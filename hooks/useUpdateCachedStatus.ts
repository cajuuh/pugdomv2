import { useCallback } from 'react';
import { InfiniteData, useQueryClient } from '@tanstack/react-query';
import { Status } from '../services/mastodon/types';
import { NotificationGroupsPage } from '../services/mastodon/notifications';

// Replaces a status in every cached timeline, including where it appears as a boost, and in cached notifications
export const useUpdateCachedStatus = () => {
    const queryClient = useQueryClient();

    return useCallback((updated: Status) => {
        queryClient.setQueriesData<InfiniteData<Status[]>>({ queryKey: ['timeline'] }, (data) => {
            if (!data) {
                return data;
            }
            return {
                ...data,
                pages: data.pages.map(page => page.map(status => {
                    if (status.id === updated.id) {
                        return updated;
                    }
                    if (status.reblog?.id === updated.id) {
                        return { ...status, reblog: updated };
                    }
                    return status;
                })),
            };
        });
        queryClient.setQueriesData<InfiniteData<NotificationGroupsPage>>({ queryKey: ['notifications'] }, (data) => {
            if (!data) {
                return data;
            }
            return {
                ...data,
                pages: data.pages.map(page => ({
                    ...page,
                    groups: page.groups.map(group => (group.status?.id === updated.id ? { ...group, status: updated } : group)),
                })),
            };
        });
    }, [queryClient]);
};
