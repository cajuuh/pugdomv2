import apiClient from '../api/client';
import { getCredentials } from '../storage';
import { nextMaxIdFromLink } from './quotes';
import { V2_UNSUPPORTED } from './notifications';
import { Account, Notification, Status } from './types';

// Mastodon 4.3+ holds back notifications its notification policy filters (people you don't follow, new
// accounts...). Each account with held notifications is a request you accept or dismiss.

// accept: shown as usual; filter: held as a request; drop: never created
export type PolicyValue = 'accept' | 'filter' | 'drop';
export const POLICY_KEYS = ['for_not_following', 'for_not_followers', 'for_new_accounts', 'for_private_mentions', 'for_limited_accounts'] as const;
export type PolicyKey = (typeof POLICY_KEYS)[number];

export type NotificationPolicy = Record<PolicyKey, PolicyValue> & {
    summary: { pending_requests_count: number; pending_notifications_count: number };
};

export interface NotificationRequest {
    id: string;
    created_at: string;
    updated_at: string;
    account: Account;
    // A string in the API, though it's a count
    notifications_count: string;
    last_status?: Status | null;
}

export interface NotificationRequestsPage {
    requests: NotificationRequest[];
    nextMaxId?: string;
}

export const notificationPolicyKey = ['notificationPolicy'];
export const notificationRequestsKey = ['notificationRequests'];

// apiClient's base URL is /api/v1, so v2 needs the full URL
const policyUrl = async () => `${(await getCredentials()).instanceUrl}/api/v2/notifications/policy`;

// null on servers without the feature (older than 4.3, or other software): the screens then leave it out
export async function getNotificationPolicy(): Promise<NotificationPolicy | null> {
    try {
        const response = await apiClient.get<NotificationPolicy>(await policyUrl());
        return response.data?.summary ? response.data : null;
    } catch (error: any) {
        if (V2_UNSUPPORTED.includes(error?.response?.status)) return null;
        throw error;
    }
}

export async function updateNotificationPolicy(change: Partial<Record<PolicyKey, PolicyValue>>): Promise<NotificationPolicy> {
    const response = await apiClient.patch<NotificationPolicy>(await policyUrl(), change);
    return response.data;
}

export async function getNotificationRequests(maxId?: string): Promise<NotificationRequestsPage> {
    const response = await apiClient.get<NotificationRequest[]>('/notifications/requests', { params: { max_id: maxId } });
    return { requests: response.data, nextMaxId: nextMaxIdFromLink(response.headers?.link) };
}

export async function acceptNotificationRequest(id: string): Promise<void> {
    await apiClient.post(`/notifications/requests/${id}/accept`);
}

export async function dismissNotificationRequest(id: string): Promise<void> {
    await apiClient.post(`/notifications/requests/${id}/dismiss`);
}

// A request's held notifications: the account's, filtered ones included
export async function getRequestNotifications(accountId: string, maxId?: string): Promise<Notification[]> {
    const response = await apiClient.get<Notification[]>('/notifications', {
        params: { account_id: accountId, include_filtered: true, max_id: maxId },
    });
    return response.data;
}

const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Accepting merges the held notifications into the list in a background job: wait (a few seconds at most)
// until it's done, so reloading Notifications shows them
export async function waitForMerge(tries = 8, intervalMs = 750): Promise<void> {
    for (let i = 0; i < tries; i++) {
        try {
            const response = await apiClient.get<{ merged: boolean }>('/notifications/requests/merged');
            if (response.data?.merged) return;
        } catch {
            return;
        }
        await pause(intervalMs);
    }
}
