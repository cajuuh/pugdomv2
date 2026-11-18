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

// Most live events (deletions and edits from a busy public stream) are about posts that aren't loaded. Those
// leave the cache alone: returning undefined skips the write, so nothing redraws or deep-compares.
const changedOnly = <T,>(data: T | undefined, edit: (data: T, change: () => void) => T): T | undefined => {
    if (!data) return undefined;
    let changed = false;
    const next = edit(data, () => (changed = true));
    return changed ? next : undefined;
};

// Replaces statuses in every cached timeline, including where they appear as boosts, and in cached notifications.
// Takes several at once (a freshly loaded thread) so the caches are walked once.
export const useUpdateCachedStatus = () => {
    const queryClient = useQueryClient();

    return useCallback((updates: Status | Status[]) => {
        const fresh = new Map((Array.isArray(updates) ? updates : [updates]).map(status => [status.id, status]));
        if (fresh.size === 0) return;
        queryClient.setQueriesData<InfiniteData<StatusPage>>({ queryKey: ['timeline'] }, current =>
            changedOnly(current, (data, change) => ({
                ...data,
                pages: data.pages.map(page => mapPage(page, status => {
                    const own = fresh.get(status.id);
                    const boosted = !own && status.reblog && fresh.get(status.reblog.id);
                    if (own || boosted) change();
                    return own || (boosted ? { ...status, reblog: boosted } : status);
                })),
            }))
        );
        queryClient.setQueriesData<InfiniteData<NotificationGroupsPage>>({ queryKey: ['notifications'] }, current =>
            changedOnly(current, (data, change) => ({
                ...data,
                pages: data.pages.map(page => ({
                    ...page,
                    groups: page.groups.map(group => {
                        const own = group.status && fresh.get(group.status.id);
                        if (own) change();
                        return own ? { ...group, status: own } : group;
                    }),
                })),
            }))
        );
    }, [queryClient]);
};

// Removes a deleted status, and boosts of it, from every cached timeline and notification
export const useRemoveCachedStatus = () => {
    const queryClient = useQueryClient();

    return useCallback((id: string) => {
        const gone = (status: Status) => status.id === id || status.reblog?.id === id;
        queryClient.setQueriesData<InfiniteData<StatusPage>>({ queryKey: ['timeline'] }, current =>
            changedOnly(current, (data, change) => ({
                ...data,
                pages: data.pages.map(page => {
                    const statuses = Array.isArray(page) ? page : page.statuses;
                    if (!statuses.some(gone)) return page;
                    change();
                    const kept = statuses.filter(status => !gone(status));
                    return Array.isArray(page) ? kept : { ...page, statuses: kept };
                }),
            }))
        );
        queryClient.setQueriesData<InfiniteData<NotificationGroupsPage>>({ queryKey: ['notifications'] }, current =>
            changedOnly(current, (data, change) => ({
                ...data,
                pages: data.pages.map(page => {
                    if (!page.groups.some(group => group.status?.id === id)) return page;
                    change();
                    return { ...page, groups: page.groups.filter(group => group.status?.id !== id) };
                }),
            }))
        );
        DeviceEventEmitter.emit(STATUS_DELETED_EVENT, id);
    }, [queryClient]);
};
