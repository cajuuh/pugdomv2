import apiClient from '../api/client';

// Saves the read position so other clients (and the web UI) stop counting these notifications as unread
export async function markNotificationsRead(lastReadId: string): Promise<void> {
    await apiClient.post('/markers', { notifications: { last_read_id: lastReadId } });
}

// The newest notification you've read, as saved by any of your apps (or none yet)
export async function getNotificationsMarker(): Promise<string | null> {
    const response = await apiClient.get<{ notifications?: { last_read_id: string } }>('/markers', { params: { timeline: ['notifications'] } });
    return response.data.notifications?.last_read_id ?? null;
}
