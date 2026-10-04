import apiClient from '../api/client';
import { Account } from './types';

// Whose replies show in the list: to people you follow, to other list members, or none
export type RepliesPolicy = 'followed' | 'list' | 'none';

export interface MastodonList {
    id: string;
    title: string;
    replies_policy: RepliesPolicy;
    // Members' posts are hidden from the home timeline
    exclusive?: boolean;
}

export type ListFields = Pick<MastodonList, 'title'> & Partial<Pick<MastodonList, 'replies_policy' | 'exclusive'>>;

export async function getLists(): Promise<MastodonList[]> {
    const response = await apiClient.get<MastodonList[]>('/lists');
    return response.data;
}

export async function createList(fields: ListFields): Promise<MastodonList> {
    const response = await apiClient.post<MastodonList>('/lists', fields);
    return response.data;
}

export async function updateList(id: string, fields: ListFields): Promise<MastodonList> {
    const response = await apiClient.put<MastodonList>(`/lists/${id}`, fields);
    return response.data;
}

export async function deleteList(id: string): Promise<void> {
    await apiClient.delete(`/lists/${id}`);
}

// limit 0 = every member (Mastodon's way of skipping pagination here)
export async function getListAccounts(id: string): Promise<Account[]> {
    const response = await apiClient.get<Account[]>(`/lists/${id}/accounts`, { params: { limit: 0 } });
    return response.data;
}

// Only accounts you follow can be added
export async function addToList(id: string, accountIds: string[]): Promise<void> {
    await apiClient.post(`/lists/${id}/accounts`, { account_ids: accountIds });
}

export async function removeFromList(id: string, accountIds: string[]): Promise<void> {
    await apiClient.delete(`/lists/${id}/accounts`, { params: { account_ids: accountIds } });
}

// Which of your lists an account is on
export async function getAccountLists(accountId: string): Promise<MastodonList[]> {
    const response = await apiClient.get<MastodonList[]>(`/accounts/${accountId}/lists`);
    return response.data;
}
