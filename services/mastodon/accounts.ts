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

export async function followAccount(accountId: string): Promise<Relationship> {
    const response = await apiClient.post<Relationship>(`/accounts/${accountId}/follow`);
    return response.data;
}

// axios serializes arrays as id[]=1&id[]=2, which is what Mastodon expects
export async function getRelationships(accountIds: string[]): Promise<Relationship[]> {
    const response = await apiClient.get<Relationship[]>('/accounts/relationships', { params: { id: accountIds } });
    return response.data;
}
