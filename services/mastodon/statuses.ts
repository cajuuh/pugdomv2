import apiClient from '../api/client';
import { nextMaxIdFromLink } from './bookmarks';
import { Account, Status, StatusEdit, StatusSource } from './types';

export interface CreateStatusParams {
    status: string;
    in_reply_to_id?: string | null;
    sensitive?: boolean;
    spoiler_text?: string;
    visibility?: 'public' | 'unlisted' | 'private' | 'direct';
    language?: string;
    // Uploaded media (see media.ts); a post can't have both media and a poll
    media_ids?: string[];
    // Quote posts (Mastodon 4.5): the post being quoted, and who may quote this one
    quoted_status_id?: string;
    quote_approval_policy?: 'public' | 'followers' | 'nobody';
    poll?: {
        options: string[];
        expires_in: number;
        multiple?: boolean;
    };
}

export async function createStatus(params: CreateStatusParams): Promise<Status> {
    const response = await apiClient.post('/statuses', params);
    return response.data;
}

export async function favouriteStatus(id: string): Promise<Status> {
    const response = await apiClient.post(`/statuses/${id}/favourite`);
    return response.data;
}

export async function unfavouriteStatus(id: string): Promise<Status> {
    const response = await apiClient.post(`/statuses/${id}/unfavourite`);
    return response.data;
}

export async function reblogStatus(id: string): Promise<Status> {
    const response = await apiClient.post(`/statuses/${id}/reblog`);
    return response.data;
}

export async function unreblogStatus(id: string): Promise<Status> {
    const response = await apiClient.post(`/statuses/${id}/unreblog`);
    return response.data;
}

export async function bookmarkStatus(id: string): Promise<Status> {
    const response = await apiClient.post(`/statuses/${id}/bookmark`);
    return response.data;
}

export async function unbookmarkStatus(id: string): Promise<Status> {
    const response = await apiClient.post(`/statuses/${id}/unbookmark`);
    return response.data;
}

export async function getStatus(id: string): Promise<Status> {
    const response = await apiClient.get(`/statuses/${id}`);
    return response.data;
}

// Who favourited or boosted a post, newest first, paged with the Link header
export type Reaction = 'favourites' | 'boosts';
export interface ReactionsPage {
    accounts: Account[];
    nextMaxId?: string;
}

export async function getReactions(id: string, reaction: Reaction, maxId?: string): Promise<ReactionsPage> {
    const path = reaction === 'favourites' ? 'favourited_by' : 'reblogged_by';
    const response = await apiClient.get<Account[]>(`/statuses/${id}/${path}`, { params: { max_id: maxId } });
    return { accounts: response.data, nextMaxId: nextMaxIdFromLink(response.headers?.link) };
}

export async function getStatusContext(id: string): Promise<{ ancestors: Status[], descendants: Status[] }> {
    const response = await apiClient.get(`/statuses/${id}/context`);
    return response.data;
}

// Deletes one of your posts. The answer carries its source text, for "delete and redraft"; its media
// stays reusable for about a day unless deleteMedia is set.
export async function deleteStatus(id: string, { deleteMedia = false }: { deleteMedia?: boolean } = {}): Promise<Status> {
    const response = await apiClient.delete<Status>(`/statuses/${id}`, { params: deleteMedia ? { delete_media: true } : undefined });
    return response.data;
}

export interface EditStatusParams {
    status: string;
    spoiler_text?: string;
    sensitive?: boolean;
    language?: string;
    media_ids?: string[];
    // Descriptions and focal points ("x,y", -1..1) of the post's media
    media_attributes?: { id: string; description?: string; focus?: string }[];
    poll?: CreateStatusParams['poll'];
    quote_approval_policy?: CreateStatusParams['quote_approval_policy'];
}

// Saves an edit; visibility, the reply and the quote can't change
export async function editStatus(id: string, params: EditStatusParams): Promise<Status> {
    const response = await apiClient.put<Status>(`/statuses/${id}`, params);
    return response.data;
}

// The plain text a post was written as, to edit it
export async function getStatusSource(id: string): Promise<StatusSource> {
    const response = await apiClient.get<StatusSource>(`/statuses/${id}/source`);
    return response.data;
}

// Every version of an edited post, oldest first
export async function getStatusHistory(id: string): Promise<StatusEdit[]> {
    const response = await apiClient.get<StatusEdit[]>(`/statuses/${id}/history`);
    return response.data;
}
