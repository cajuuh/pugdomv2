import apiClient, { publicClient } from "../api/client";
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
    exclude_reblogs?: boolean;
    only_media?: boolean;
    pinned?: boolean;
}

// An account's posts, newest first
export async function getAccountStatuses(accountId: string, maxId?: string, filter: AccountStatusesFilter = {}): Promise<Status[]> {
    const response = await apiClient.get<Status[]>(`/accounts/${accountId}/statuses`, { params: { max_id: maxId, ...filter } });
    return response.data;
}

// Who follows an account, or whom it follows, newest first, paged with the Link header.
// Empty when the person hides them.
export type FollowList = 'followers' | 'following';

// Someone's account on their own server: where their lists come from
export interface HomeAccount {
    domain: string;
    id: string;
}
export interface FollowsPage extends ReactionsPage {
    // Read from their server: the accounts' ids are that server's, not ours
    home?: HomeAccount;
}

// For someone on another server, ours only knows who they follow (or who follows them) here: the whole
// list is read from their server, without an account. `home` comes from the first page. Our server's
// list stands in when theirs can't be read or is hidden (empty).
export async function getFollows(
    account: Pick<Account, 'id' | 'acct' | 'url'>,
    list: FollowList,
    maxId?: string,
    home?: HomeAccount
): Promise<FollowsPage> {
    const [username, domain] = account.acct.split('@');
    const host = account.url?.match(/^https?:\/\/([^/?#]+)/)?.[1];
    if (domain && host && (home || !maxId)) {
        try {
            const theirs = home ?? {
                domain: host,
                id: (await publicClient.get<Account>(`https://${host}/api/v1/accounts/lookup`, { params: { acct: username } })).data.id,
            };
            const response = await publicClient.get<Account[]>(`https://${theirs.domain}/api/v1/accounts/${theirs.id}/${list}`, {
                params: { max_id: maxId, limit: 80 },
            });
            if (home || response.data.length > 0) {
                return {
                    // Their server's own people have no @server in their handle
                    accounts: response.data.map(person => (person.acct.includes('@') ? person : { ...person, acct: `${person.acct}@${domain}` })),
                    nextMaxId: nextMaxIdFromLink(response.headers?.link),
                    home: theirs,
                };
            }
        } catch (error) {
            // Halfway through their list, a failed page is an error, not a switch to ours
            if (home) throw error;
        }
    }
    // 80 is Mastodon's most per page: fewer requests when a search loads the whole list
    const response = await apiClient.get<Account[]>(`/accounts/${account.id}/${list}`, { params: { max_id: maxId, limit: 80 } });
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

// They stop following you (a soft block, without blocking); they aren't told
// Your private note on someone, kept on your server (empty removes it). Mastodon's limit is 2,000 characters.
export const NOTE_LIMIT = 2000;
export async function setAccountNote(accountId: string, comment: string): Promise<Relationship> {
    const response = await apiClient.post<Relationship>(`/accounts/${accountId}/note`, { comment });
    return response.data;
}

export async function removeFromFollowers(accountId: string): Promise<Relationship> {
    const response = await apiClient.post<Relationship>(`/accounts/${accountId}/remove_from_followers`);
    return response.data;
}

// Muting hides their posts (and, by default, notifications from them); they aren't told. A duration
// in seconds ends it on its own; 0 lasts until you unmute.
export async function muteAccount(accountId: string, duration = 0): Promise<Relationship> {
    const response = await apiClient.post<Relationship>(`/accounts/${accountId}/mute`, { notifications: true, duration });
    return response.data;
}

// The people you muted or blocked, paged with the Link header. Muted accounts say when a timed mute
// ends (mute_expires_at).
export type ModeratedList = 'mutes' | 'blocks';
export async function getModeratedAccounts(list: ModeratedList, maxId?: string): Promise<ReactionsPage> {
    const response = await apiClient.get<Account[]>(`/${list}`, { params: { max_id: maxId, limit: 80 } });
    return { accounts: response.data, nextMaxId: nextMaxIdFromLink(response.headers?.link) };
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
