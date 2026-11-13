import { InfiniteData, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    acceptNotificationRequest,
    dismissNotificationRequest,
    getNotificationPolicy,
    getNotificationRequests,
    notificationPolicyKey,
    notificationRequestsKey,
    NotificationRequest,
    NotificationRequestsPage,
    waitForMerge,
} from '../services/mastodon/notificationRequests';
import { dialog } from '../services/dialog';
import { useI18n } from '../services/i18n/i18nContext';

// null when the server has no notification policy (older than Mastodon 4.3)
export const useNotificationPolicy = () =>
    useQuery({ queryKey: notificationPolicyKey, queryFn: getNotificationPolicy, staleTime: 60_000 });

export const useNotificationRequests = () =>
    useInfiniteQuery({
        queryKey: notificationRequestsKey,
        queryFn: ({ pageParam }) => getNotificationRequests(pageParam),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (page: NotificationRequestsPage) => page.nextMaxId,
    });

// Accept or dismiss a request: it leaves the list at once (and comes back if the server says no)
export const useRequestActions = () => {
    const queryClient = useQueryClient();
    const { t } = useI18n();

    const act = async (request: NotificationRequest, accept: boolean) => {
        const previous = queryClient.getQueryData<InfiniteData<NotificationRequestsPage>>(notificationRequestsKey);
        queryClient.setQueryData<InfiniteData<NotificationRequestsPage>>(notificationRequestsKey, current =>
            current && { ...current, pages: current.pages.map(page => ({ ...page, requests: page.requests.filter(item => item.id !== request.id) })) }
        );
        try {
            await (accept ? acceptNotificationRequest(request.id) : dismissNotificationRequest(request.id));
            dialog.toast(t(accept ? 'filteredNotifications.accepted' : 'filteredNotifications.dismissed'));
            queryClient.invalidateQueries({ queryKey: notificationPolicyKey });
            if (accept) {
                await waitForMerge();
                queryClient.invalidateQueries({ queryKey: ['notifications'] });
            }
            return true;
        } catch (error) {
            console.warn('Notification request action failed:', error);
            queryClient.setQueryData(notificationRequestsKey, previous);
            dialog.toast(t('filteredNotifications.failed'));
            return false;
        }
    };

    return {
        accept: (request: NotificationRequest) => act(request, true),
        dismiss: (request: NotificationRequest) => act(request, false),
    };
};
