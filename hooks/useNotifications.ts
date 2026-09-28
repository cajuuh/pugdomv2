import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchNotifications } from '../services/mastodon/notifications';
import { Notification } from '../services/mastodon/types';

export type NotificationFilter = 'all' | 'mentions' | 'follows';

// The notification types the screen knows how to render
export const SUPPORTED_NOTIFICATION_TYPES: Notification['type'][] = ['mention', 'reblog', 'favourite', 'follow'];

// Filtering happens on the server, so every page is full of matching notifications
const FILTER_TYPES: Record<NotificationFilter, Notification['type'][]> = {
    all: SUPPORTED_NOTIFICATION_TYPES,
    mentions: ['mention'],
    follows: ['follow'],
};

export const useNotifications = (filter: NotificationFilter) => {
    return useInfiniteQuery({
        queryKey: ['notifications', filter],
        queryFn: ({ pageParam }) => fetchNotifications(pageParam, FILTER_TYPES[filter]),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage: Notification[]) =>
            lastPage.length > 0 ? lastPage[lastPage.length - 1].id : undefined,
    });
};
