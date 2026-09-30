import apiClient from '../api/client';
import { getCredentials } from '../storage';
import { GroupedNotificationsResponse, Notification, NotificationGroup } from './types';

// Folded into one row per post; follows stay one row each so every follower keeps its Follow back button
export const GROUPED_TYPES: Notification['type'][] = ['favourite', 'reblog'];

export interface NotificationGroupsPage {
    groups: NotificationGroup[];
    // max_id for the next page; undefined when there is none
    nextMaxId?: string;
}

// axios serializes `types` as types[]=a&types[]=b, which is what Mastodon expects
export async function fetchNotifications(maxId?: string, types?: Notification['type'][]): Promise<Notification[]> {
    const response = await apiClient.get('/notifications', {
        params: { max_id: maxId, types },
    });
    return response.data;
}

// Snowflake ids: a longer id is newer, and equal lengths compare as strings
export const isNewerId = (a: string, b: string) => (a.length !== b.length ? a.length > b.length : a > b);

// v1 notifications as rows, grouping favourites and boosts by post
export const groupsFromNotifications = (notifications: Notification[]): NotificationGroup[] =>
    mergeGroups(notifications.map(notification => ({
        key: notification.status && GROUPED_TYPES.includes(notification.type)
            ? `${notification.type}-${notification.status.id}`
            : `ungrouped-${notification.id}`,
        type: notification.type,
        accounts: [notification.account],
        count: 1,
        status: notification.status,
        created_at: notification.created_at,
        newestId: notification.id,
        partial: true,
    })));

export const groupsFromV2 = (data: GroupedNotificationsResponse): NotificationGroup[] => {
    const accounts = new Map(data.accounts.map(account => [account.id, account]));
    const statuses = new Map(data.statuses.map(status => [status.id, status]));
    return data.notification_groups.map(group => ({
        key: group.group_key,
        type: group.type,
        accounts: group.sample_account_ids.map(id => accounts.get(id)).filter(account => !!account),
        count: group.notifications_count,
        status: group.status_id ? statuses.get(group.status_id) : undefined,
        created_at: group.latest_page_notification_at ?? '',
        newestId: group.page_max_id ?? group.most_recent_notification_id,
    }));
};

// Joins rows for the same group across pages. A v2 group already has its full count, so a repeat is dropped;
// a client-side (v1) group only knows its own page, so repeats add their accounts and count.
export const mergeGroups = (groups: NotificationGroup[]): NotificationGroup[] => {
    const merged = new Map<string, NotificationGroup>();
    groups.forEach(group => {
        const existing = merged.get(group.key);
        if (!existing) {
            merged.set(group.key, { ...group });
        } else if (existing.partial) {
            const known = new Set(existing.accounts.map(account => account.id));
            existing.accounts = [...existing.accounts, ...group.accounts.filter(account => !known.has(account.id))];
            existing.count += group.count;
        }
    });
    return [...merged.values()];
};

// Servers older than Mastodon 4.3 (and other software) answer v2 with one of these
const V2_UNSUPPORTED = [400, 404, 405, 501];
// Instances known to lack v2, so each page after the first goes straight to v1
const v1Instances = new Set<string>();

export async function fetchNotificationGroups(maxId?: string, types?: Notification['type'][]): Promise<NotificationGroupsPage> {
    const { instanceUrl } = await getCredentials();
    if (instanceUrl && !v1Instances.has(instanceUrl)) {
        try {
            // apiClient's base URL is /api/v1, so the v2 endpoint needs the full URL
            const response = await apiClient.get<GroupedNotificationsResponse>(`${instanceUrl}/api/v2/notifications`, {
                params: { max_id: maxId, types, grouped_types: GROUPED_TYPES },
            });
            const groups = response.data.notification_groups;
            const oldest = groups
                .map(group => group.page_min_id ?? group.most_recent_notification_id)
                .reduce<string | undefined>((min, id) => (!min || isNewerId(min, id) ? id : min), undefined);
            return { groups: groupsFromV2(response.data), nextMaxId: oldest };
        } catch (error: any) {
            if (!V2_UNSUPPORTED.includes(error?.response?.status)) {
                throw error;
            }
            v1Instances.add(instanceUrl);
        }
    }

    const notifications = await fetchNotifications(maxId, types);
    return {
        groups: groupsFromNotifications(notifications),
        nextMaxId: notifications.length > 0 ? notifications[notifications.length - 1].id : undefined,
    };
}
