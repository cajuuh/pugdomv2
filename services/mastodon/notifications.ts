import apiClient from '../api/client';
import { Notification } from './types';

// axios serializes `types` as types[]=a&types[]=b, which is what Mastodon expects
export async function fetchNotifications(maxId?: string, types?: Notification['type'][]): Promise<Notification[]> {
    const response = await apiClient.get('/notifications', {
        params: { max_id: maxId, types },
    });
    return response.data;
}
