import apiClient from '../api/client';
import { Status } from './types';

export interface CreateStatusParams {
    status: string;
    in_reply_to_id?: string | null;
    sensitive?: boolean;
    spoiler_text?: string;
    visibility?: 'public' | 'unlisted' | 'private' | 'direct';
    language?: string;
}

export async function createStatus(params: CreateStatusParams): Promise<Status> {
    const response = await apiClient.post('/statuses', params);
    return response.data;
}
