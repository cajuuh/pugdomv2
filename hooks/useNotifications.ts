import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchNotificationGroups, NotificationGroupsPage } from '../services/mastodon/notifications';
import { Notification } from '../services/mastodon/types';
import { useSettings } from '../services/settingsContext';

export type NotificationFilter = 'all' | 'mentions' | 'follows';

// The notification types the screen knows how to render
export const SUPPORTED_NOTIFICATION_TYPES: Notification['type'][] = ['mention', 'reblog', 'favourite', 'follow', 'quote', 'quoted_update'];

// Filtering happens on the server, so every page is full of matching notifications
const FILTER_TYPES: Record<NotificationFilter, Notification['type'][]> = {
    all: SUPPORTED_NOTIFICATION_TYPES,
    mentions: ['mention'],
    follows: ['follow'],
};

export const useNotifications = (filter: NotificationFilter) => {
    const { groupNotifications } = useSettings();
    return useInfiniteQuery({
        queryKey: ['notifications', filter, groupNotifications],
        queryFn: ({ pageParam }) => fetchNotificationGroups(pageParam, FILTER_TYPES[filter], groupNotifications),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage: NotificationGroupsPage) => lastPage.nextMaxId,
    });
};
