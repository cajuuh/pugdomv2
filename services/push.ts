import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { publicClient } from './api/client';
import { SavedAccount } from './storage';
import { Notification } from './mastodon/types';
import { Route } from './navigationContext';

// relay/ in this repo: turns Mastodon's Web Push into Expo Push (decrypting it there, storing nothing)
export const RELAY_URL = 'https://pugdom-relay.cajuuh.workers.dev';
// Matches expo-notifications' defaultChannel in app.json, which pushes without a channel use
export const ANDROID_CHANNEL = 'default';

// The notification types with a switch in Settings (Mastodon's data[alerts] keys)
export const PUSH_ALERT_TYPES = ['mention', 'status', 'reblog', 'favourite', 'follow', 'follow_request', 'poll', 'update', 'quote'] as const;
export type PushAlertType = typeof PUSH_ALERT_TYPES[number];
export type PushAlerts = Record<PushAlertType, boolean>;
export const DEFAULT_PUSH_ALERTS = Object.fromEntries(PUSH_ALERT_TYPES.map(type => [type, true])) as PushAlerts;

// What the relay puts in each push's data
export interface PushData {
    account: string; // SavedAccount id
    notificationId: string;
    type: Notification['type'];
}

// Asks the first time; false when the person said no (the system won't ask again)
export async function requestPushPermission(channelName: string): Promise<boolean> {
    // Android shows the permission prompt only once a channel exists
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
            name: channelName,
            importance: Notifications.AndroidImportance.HIGH,
        });
    }
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    return (await Notifications.requestPermissionsAsync()).granted;
}

const authHeader = (account: SavedAccount) => ({ headers: { Authorization: `Bearer ${account.accessToken}` } });

// One subscription per access token: a new one replaces the account's old one on the server
export async function subscribe(account: SavedAccount, expoToken: string, alerts: PushAlerts): Promise<void> {
    const { data: keys } = await publicClient.post<{ endpoint: string; p256dh: string; auth: string }>(
        `${RELAY_URL}/register`, { token: expoToken, account: account.id });
    await publicClient.post(`${account.instanceUrl}/api/v1/push/subscription`, {
        // standard: RFC 8291 encryption, the only kind the relay reads (Mastodon 4.4+)
        subscription: { endpoint: keys.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth }, standard: true },
        data: { alerts: { ...alerts, quoted_update: alerts.quote }, policy: 'all' },
    }, authHeader(account));
}

export async function unsubscribe(account: SavedAccount): Promise<void> {
    await publicClient.delete(`${account.instanceUrl}/api/v1/push/subscription`, authHeader(account));
}

// Brings every saved account's server subscription in line with the settings.
// Subscribing again is how a new Expo token or changed alerts reach the server.
export async function syncPush(accounts: SavedAccount[], enabled: boolean, alerts: PushAlerts, channelName: string): Promise<void> {
    if (!enabled) {
        await Promise.allSettled(accounts.map(unsubscribe));
        return;
    }
    if (!(await requestPushPermission(channelName))) return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const results = await Promise.allSettled(accounts.map(account => subscribe(account, token, alerts)));
    results.forEach((result, i) => {
        if (result.status === 'rejected') console.warn(`Push subscription failed for ${accounts[i].id}:`, result.reason);
    });
}

// Where a tapped push opens: the post it's about, else the profile of who it's from
export function routeForNotification(notification: Notification): Route {
    if (notification.status) return { name: 'thread', statusId: notification.status.id };
    return { name: 'account', accountId: notification.account.id, account: notification.account };
}
