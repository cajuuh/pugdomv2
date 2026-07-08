import apiClient from '../api/client';
import { Notification } from './types';

export async function fetchNotifications(maxId?: string): Promise<Notification[]> {
    const response = await apiClient.get('/notifications', {
        params: { max_id: maxId },
    });
    return response.data;
}
