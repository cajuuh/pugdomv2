import { useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../services/authContext';
import { useSettings } from '../services/settingsContext';
import { useI18n } from '../services/i18n/i18nContext';
import { useNavigator } from '../services/navigationContext';
import { getCredentials } from '../services/storage';
import { getNotification } from '../services/mastodon/notifications';
import { PushData, routeForNotification, syncPush } from '../services/push';

// Pushes that arrive while pugdon is open still show as a banner
Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

// Keeps every saved account's push subscription in line with Settings, and opens what a tapped push is about.
// `ready`: signed in and past setup.
export function usePushNotifications(ready: boolean, openNotifications: () => void) {
    const { user, savedAccounts, switchAccount } = useAuth();
    const { notifications: enabled, pushAlerts, loadingSettings } = useSettings();
    const { t } = useI18n();
    const { push } = useNavigator();

    // Subscribes again on each start (the Expo token can change), and when an account or a switch changes
    const accountsKey = savedAccounts.map(account => `${account.id} ${account.accessToken}`).join('\n');
    const alertsKey = JSON.stringify(pushAlerts);
    useEffect(() => {
        if (!ready || loadingSettings) return;
        syncPush(savedAccounts, enabled, pushAlerts, t('push.channel')).catch(error => console.warn('Push sync failed:', error));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, loadingSettings, enabled, alertsKey, accountsKey]);

    // The tap that opened the app, or one while it runs
    const response = Notifications.useLastNotificationResponse();
    const handled = useRef<string | null>(null);
    const [pending, setPending] = useState<PushData | null>(null);
    useEffect(() => {
        if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
        const id = response.notification.request.identifier;
        if (handled.current === id) return;
        handled.current = id;
        Notifications.clearLastNotificationResponse();
        setPending(response.notification.request.content.data as unknown as PushData);
    }, [response]);

    useEffect(() => {
        if (!pending || !ready) return;
        (async () => {
            const target = savedAccounts.find(account => account.id === pending.account);
            const { accessToken } = await getCredentials();
            if (target && target.accessToken !== accessToken) {
                // Runs again once the other account is signed in
                switchAccount(target.id);
                return;
            }
            setPending(null);
            try {
                push(routeForNotification(await getNotification(pending.notificationId)));
            } catch {
                // Removed meanwhile, or from an account that's gone
                openNotifications();
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pending, ready, user?.id]);
}
