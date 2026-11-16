import apiClient from '../api/client';
import { Account, Collection, CollectionItem } from './types';

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

export interface CollectionFields {
    name: string;
    description?: string;
    // The topic, a hashtag without the #; empty clears it
    tag_name?: string;
    sensitive?: boolean;
    // Shown on your profile; otherwise only reachable by its link
    discoverable?: boolean;
}

// Limits from Mastodon 4.6
export const COLLECTION_NAME_MAX = 40;
export const COLLECTION_DESCRIPTION_MAX = 100;
export const COLLECTION_MAX_ACCOUNTS = 25;

export async function createCollection(fields: CollectionFields, accountIds: string[] = []): Promise<Collection> {
    const response = await apiClient.post<{ collection: Collection }>('/collections', { ...fields, account_ids: accountIds });
    return response.data.collection;
}

// Changes the name and settings; its people change through addToCollection and removeFromCollection
export async function updateCollection(id: string, fields: CollectionFields): Promise<Collection> {
    const response = await apiClient.patch<{ collection: Collection }>(`/collections/${id}`, fields);
    return response.data.collection;
}

export async function deleteCollection(id: string): Promise<void> {
    await apiClient.delete(`/collections/${id}`);
}

export async function addToCollection(id: string, accountId: string): Promise<CollectionItem> {
    const response = await apiClient.post<{ collection_item: CollectionItem }>(`/collections/${id}/items`, { account_id: accountId });
    return response.data.collection_item;
}

// Takes someone out of your collection. Uses the item's id, not the account's
export async function removeFromCollection(id: string, itemId: string): Promise<void> {
    await apiClient.delete(`/collections/${id}/items/${itemId}`);
}

// Takes yourself out of someone else's collection
export async function leaveCollection(id: string, itemId: string): Promise<void> {
    await apiClient.post(`/collections/${id}/items/${itemId}/revoke`);
}

// Whether you can put this person in a collection
export const canFeature = (account: Pick<Account, 'feature_approval'>) =>
    account.feature_approval?.current_user === 'automatic' || account.feature_approval?.current_user === 'manual';

// The item for this person in a collection, if they're in it (agreed or not yet)
export const itemFor = (collection: Collection, accountId: string) =>
    collection.items.find(item => item.account_id === accountId && (item.state === 'accepted' || item.state === 'pending'));
