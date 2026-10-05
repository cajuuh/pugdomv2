import apiClient from "../api/client";
import { Account, Relationship, Status } from './types';

export async function getCurrentAccount(): Promise<Account> {
    const response = await apiClient.get<Account>('accounts/verify_credentials');
    return response.data;
}

export interface AccountStatusesFilter {
    exclude_replies?: boolean;
    only_media?: boolean;
}

// An account's posts, newest first
export async function getAccountStatuses(accountId: string, maxId?: string, filter: AccountStatusesFilter = {}): Promise<Status[]> {
    const response = await apiClient.get<Status[]>(`/accounts/${accountId}/statuses`, { params: { max_id: maxId, ...filter } });
    return response.data;
}

export async function getAccount(accountId: string): Promise<Account> {
    const response = await apiClient.get<Account>(`/accounts/${accountId}`);
    return response.data;
}

export async function followAccount(accountId: string): Promise<Relationship> {
    const response = await apiClient.post<Relationship>(`/accounts/${accountId}/follow`);
    return response.data;
}

// Also cancels a pending follow request
export async function unfollowAccount(accountId: string): Promise<Relationship> {
    const response = await apiClient.post<Relationship>(`/accounts/${accountId}/unfollow`);
    return response.data;
}

// axios serializes arrays as id[]=1&id[]=2, which is what Mastodon expects
export async function getRelationships(accountIds: string[]): Promise<Relationship[]> {
    const response = await apiClient.get<Relationship[]>('/accounts/relationships', { params: { id: accountIds } });
    return response.data;
}

// Blocking hides them from you and you from them, and removes any follow between you
export async function blockAccount(accountId: string): Promise<Relationship> {
    const response = await apiClient.post<Relationship>(`/accounts/${accountId}/block`);
    return response.data;
}

export async function unblockAccount(accountId: string): Promise<Relationship> {
    const response = await apiClient.post<Relationship>(`/accounts/${accountId}/unblock`);
    return response.data;
}

// Muting hides their posts (and, by default, notifications from them); they aren't told
export async function muteAccount(accountId: string): Promise<Relationship> {
    const response = await apiClient.post<Relationship>(`/accounts/${accountId}/mute`, { notifications: true });
    return response.data;
}

export async function unmuteAccount(accountId: string): Promise<Relationship> {
    const response = await apiClient.post<Relationship>(`/accounts/${accountId}/unmute`);
    return response.data;
}
