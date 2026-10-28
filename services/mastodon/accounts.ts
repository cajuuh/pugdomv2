import apiClient from "../api/client";
import { Account, Relationship, Status } from './types';
import { UploadFile } from './media';
import { nextMaxIdFromLink } from './bookmarks';
import type { ReactionsPage } from './statuses';

export async function getCurrentAccount(): Promise<Account> {
    const response = await apiClient.get<Account>('accounts/verify_credentials');
    return response.data;
}

export interface AccountStatusesFilter {
    exclude_replies?: boolean;
    only_media?: boolean;
    pinned?: boolean;
}

// An account's posts, newest first
export async function getAccountStatuses(accountId: string, maxId?: string, filter: AccountStatusesFilter = {}): Promise<Status[]> {
    const response = await apiClient.get<Status[]>(`/accounts/${accountId}/statuses`, { params: { max_id: maxId, ...filter } });
    return response.data;
}

// Who follows an account, or whom it follows, newest first, paged with the Link header.
// Empty when the person hides them; for someone on another server, only the ones this server knows.
export type FollowList = 'followers' | 'following';
export async function getFollows(accountId: string, list: FollowList, maxId?: string): Promise<ReactionsPage> {
    // 80 is Mastodon's most per page: fewer requests when a search loads the whole list
    const response = await apiClient.get<Account[]>(`/accounts/${accountId}/${list}`, { params: { max_id: maxId, limit: 80 } });
    return { accounts: response.data, nextMaxId: nextMaxIdFromLink(response.headers?.link) };
}

export async function getAccount(accountId: string): Promise<Account> {
    const response = await apiClient.get<Account>(`/accounts/${accountId}`);
    return response.data;
}

// `notify` turns the bell on or off: a notification whenever they post (following them again keeps the follow)
export async function followAccount(accountId: string, options?: { notify?: boolean }): Promise<Relationship> {
    const response = await apiClient.post<Relationship>(`/accounts/${accountId}/follow`, options);
    return response.data;
}

// Someone asked to follow your locked account
export async function authorizeFollowRequest(accountId: string): Promise<void> {
    await apiClient.post(`/follow_requests/${accountId}/authorize`);
}

export async function rejectFollowRequest(accountId: string): Promise<void> {
    await apiClient.post(`/follow_requests/${accountId}/reject`);
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

// Who can quote your new posts by default (Mastodon 4.5)
export async function updateDefaultQuotePolicy(policy: 'public' | 'followers' | 'nobody'): Promise<Account> {
    const response = await apiClient.patch<Account>('/accounts/update_credentials', { source: { quote_policy: policy } });
    return response.data;
}

export interface ProfileChanges {
    displayName: string;
    note: string;
    fields: { name: string; value: string }[];
    locked: boolean;
    bot: boolean;
    discoverable: boolean;
    // New images, already cropped and sized
    avatar?: UploadFile;
    header?: UploadFile;
}

// Saves your profile. Multipart, since it may carry images; every field slot is sent, so emptied ones are cleared.
export async function updateProfile(changes: ProfileChanges, maxFields: number): Promise<Account> {
    const form = new FormData();
    form.append('display_name', changes.displayName);
    form.append('note', changes.note);
    form.append('locked', String(changes.locked));
    form.append('bot', String(changes.bot));
    form.append('discoverable', String(changes.discoverable));
    for (let i = 0; i < maxFields; i++) {
        form.append(`fields_attributes[${i}][name]`, changes.fields[i]?.name ?? '');
        form.append(`fields_attributes[${i}][value]`, changes.fields[i]?.value ?? '');
    }
    // React Native's FormData sends a file given its uri, name and type
    if (changes.avatar) form.append('avatar', changes.avatar as unknown as Blob);
    if (changes.header) form.append('header', changes.header as unknown as Blob);

    const response = await apiClient.patch<Account>('/accounts/update_credentials', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
    });
    return response.data;
}
