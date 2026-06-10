import apiClient from "../api/client";
import { Account, Status } from './types';

export async function getCurrentAccount(): Promise<Account> {
    const response = await apiClient.get<Account>('accounts/verify_credentials');
    return response.data;
}

// get toots
export async function getAccountStatuses(accountId: string, maxId?: string): Promise<Status[]> {
    const response = await apiClient.get<Status[]>(`/accounts/${accountId}/statuses`, { params: { max_id: maxId } });
    return response.data;
}