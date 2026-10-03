import apiClient from '../api/client';

// Saves the read position so other clients (and the web UI) stop counting these notifications as unread
export async function markNotificationsRead(lastReadId: string): Promise<void> {
    await apiClient.post('/markers', { notifications: { last_read_id: lastReadId } });
}
