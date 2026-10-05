import { useCallback, useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOptionalAuth } from '../services/authContext';
import { getNewestNotificationId, isNewerId } from '../services/mastodon/notifications';
import { getNotificationsMarker } from '../services/mastodon/markers';
import { getSeenNotificationId, setSeenNotificationId } from '../services/notificationsSeen';
import { SUPPORTED_NOTIFICATION_TYPES } from './useNotifications';

export const UNREAD_NOTIFICATIONS_INTERVAL_MS = 60_000;
const unreadKey = (accountId: string) => ['unreadNotifications', accountId];

// Unread when the newest notification is newer than both what you read anywhere (the server's
// marker) and what you last saw on this device
export const hasUnread = (newest: string | null, marker: string | null, seen: string | null) =>
    !!newest && (!marker || isNewerId(newest, marker)) && (!seen || isNewerId(newest, seen));

// Only pause in the background: at launch the state can still be 'unknown'
const isForeground = (state: AppStateStatus | null) => state !== 'background';

// Whether the bell gets a dot. Checks every minute while the app is in the foreground, and when it
// comes back from the background.
export const useUnreadNotifications = () => {
    const accountId = useOptionalAuth()?.user?.id;
    const [active, setActive] = useState(isForeground(AppState.currentState));

    useEffect(() => {
        const subscription = AppState.addEventListener('change', state => setActive(isForeground(state)));
        return () => subscription.remove();
    }, []);

    const { data } = useQuery({
        queryKey: unreadKey(accountId ?? ''),
        queryFn: async () => {
            const [newest, marker, seen] = await Promise.all([
                getNewestNotificationId(SUPPORTED_NOTIFICATION_TYPES),
                getNotificationsMarker().catch(() => null),
                getSeenNotificationId(accountId!),
            ]);
            return hasUnread(newest, marker, seen);
        },
        enabled: !!accountId && active,
        refetchInterval: active ? UNREAD_NOTIFICATIONS_INTERVAL_MS : false,
        refetchOnWindowFocus: true,
    });

    return !!data;
};

// The notifications tab calls this with the newest one it shows, which clears the dot
export const useMarkNotificationsSeen = () => {
    const accountId = useOptionalAuth()?.user?.id;
    const queryClient = useQueryClient();
    return useCallback(async (id: string) => {
        if (!accountId) return;
        // Saved first, so a check already on its way reads it
        await setSeenNotificationId(accountId, id);
        await queryClient.cancelQueries({ queryKey: unreadKey(accountId) });
        queryClient.setQueryData(unreadKey(accountId), false);
    }, [accountId, queryClient]);
};
