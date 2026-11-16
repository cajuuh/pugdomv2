import apiClient from '../api/client';
import { Account, Collection } from './types';

// The collections on someone's profile; yours include the ones only reachable by link.
// ponytail: the first 80 only (Mastodon allows 10 per person by default); page with `offset` if servers raise that
export async function getAccountCollections(accountId: string): Promise<Collection[]> {
    const response = await apiClient.get<{ collections?: Collection[] }>(`/accounts/${accountId}/collections`, { params: { limit: 80 } });
    return response.data.collections ?? [];
}

// A collection and everyone in it (the owner too). Others only see people who agreed to be featured.
export async function getCollection(id: string): Promise<{ collection: Collection; accounts: Account[] }> {
    const response = await apiClient.get<{ collection: Collection; accounts?: Account[] }>(`/collections/${id}`);
    return { collection: response.data.collection, accounts: response.data.accounts ?? [] };
}

// The collection's people in its own order, without the owner: the ones who agreed, plus pending ones for the owner
export const featuredAccounts = (collection: Collection, accounts: Account[], viewerId?: string) => {
    const byId = new Map(accounts.map(account => [account.id, account]));
    const isOwner = viewerId === collection.account_id;
    return collection.items
        .filter(item => item.state === 'accepted' || (isOwner && item.state === 'pending'))
        .map(item => ({ item, account: item.account_id ? byId.get(item.account_id) : undefined }))
        .filter((entry): entry is { item: Collection['items'][number]; account: Account } => !!entry.account);
};
