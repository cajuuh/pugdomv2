import { useCallback } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { InfiniteData, useQueryClient } from '@tanstack/react-query';
import { Status } from '../services/mastodon/types';
import { NotificationGroupsPage } from '../services/mastodon/notifications';
import { BookmarksPage } from '../services/mastodon/bookmarks';

// Timeline pages are status arrays; bookmark pages carry their own cursor next to the statuses
type StatusPage = Status[] | BookmarksPage;

const mapPage = (page: StatusPage, update: (status: Status) => Status): StatusPage =>
    Array.isArray(page) ? page.map(update) : { ...page, statuses: page.statuses.map(update) };

// Screens that keep posts in their own state (threads) listen for these
export const STATUS_UPDATED_EVENT = 'status_updated';
export const STATUS_DELETED_EVENT = 'status_deleted';

// Replaces statuses in every cached timeline, including where they appear as boosts, and in cached notifications.
// Takes several at once (a freshly loaded thread) so the caches are walked once.
export const useUpdateCachedStatus = () => {
    const queryClient = useQueryClient();

    return useCallback((updates: Status | Status[]) => {
        const fresh = new Map((Array.isArray(updates) ? updates : [updates]).map(status => [status.id, status]));
        if (fresh.size === 0) return;
        queryClient.setQueriesData<InfiniteData<StatusPage>>({ queryKey: ['timeline'] }, (data) => {
            if (!data) {
                return data;
            }
            return {
                ...data,
                pages: data.pages.map(page => mapPage(page, status => {
                    const own = fresh.get(status.id);
                    if (own) {
                        return own;
                    }
                    const boosted = status.reblog && fresh.get(status.reblog.id);
                    return boosted ? { ...status, reblog: boosted } : status;
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
                    groups: page.groups.map(group => {
                        const own = group.status && fresh.get(group.status.id);
                        return own ? { ...group, status: own } : group;
                    }),
                })),
            };
        });
    }, [queryClient]);
};

// Removes a deleted status, and boosts of it, from every cached timeline and notification
export const useRemoveCachedStatus = () => {
    const queryClient = useQueryClient();

    return useCallback((id: string) => {
        const keep = (status: Status) => status.id !== id && status.reblog?.id !== id;
        queryClient.setQueriesData<InfiniteData<StatusPage>>({ queryKey: ['timeline'] }, (data) =>
            data && {
                ...data,
                pages: data.pages.map(page => (Array.isArray(page) ? page.filter(keep) : { ...page, statuses: page.statuses.filter(keep) })),
            }
        );
        queryClient.setQueriesData<InfiniteData<NotificationGroupsPage>>({ queryKey: ['notifications'] }, (data) =>
            data && { ...data, pages: data.pages.map(page => ({ ...page, groups: page.groups.filter(group => group.status?.id !== id) })) }
        );
        DeviceEventEmitter.emit(STATUS_DELETED_EVENT, id);
    }, [queryClient]);
};
