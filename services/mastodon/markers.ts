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

// Where you were in Home, as the first post on screen. Mastodon keeps it per account, so other apps
// (and pugdon on another device) can open there too.
export async function saveHomeMarker(lastReadId: string): Promise<void> {
    await apiClient.post('/markers', { home: { last_read_id: lastReadId } });
}

export async function getHomeMarker(): Promise<string | null> {
    const response = await apiClient.get<{ home?: { last_read_id: string } }>('/markers', { params: { timeline: ['home'] } });
    return response.data.home?.last_read_id ?? null;
}
