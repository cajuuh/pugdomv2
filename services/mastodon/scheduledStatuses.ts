import apiClient from '../api/client';
import { nextMaxIdFromLink } from './bookmarks';
import { Attachment } from './types';

// A post the server will publish later (POST /statuses with scheduled_at)
export interface ScheduledStatus {
    id: string;
    scheduled_at: string;
    params: {
        text: string;
        spoiler_text?: string | null;
        visibility?: string | null;
        in_reply_to_id?: string | null;
        poll?: { options: string[] } | null;
    };
    media_attachments: Attachment[];
}

export interface ScheduledStatusesPage {
    statuses: ScheduledStatus[];
    nextMaxId?: string;
}

export async function getScheduledStatuses(maxId?: string): Promise<ScheduledStatusesPage> {
    const response = await apiClient.get<ScheduledStatus[]>('/scheduled_statuses', { params: { max_id: maxId } });
    return { statuses: response.data, nextMaxId: nextMaxIdFromLink(response.headers?.link) };
}

export async function rescheduleStatus(id: string, at: Date): Promise<ScheduledStatus> {
    const response = await apiClient.put<ScheduledStatus>(`/scheduled_statuses/${id}`, { scheduled_at: at.toISOString() });
    return response.data;
}

export async function cancelScheduledStatus(id: string): Promise<void> {
    await apiClient.delete(`/scheduled_statuses/${id}`);
}

// Mastodon refuses anything sooner than five minutes from now
export const MIN_SCHEDULE_MS = 5 * 60_000;
export const canSchedule = (at: Date, now = new Date()) => at.getTime() - now.getTime() >= MIN_SCHEDULE_MS;

// The first choice offered: an hour from now, on a five-minute mark
export const defaultScheduleTime = (now = new Date()) => {
    const at = new Date(now.getTime() + 60 * 60_000);
    at.setSeconds(0, 0);
    at.setMinutes(Math.ceil(at.getMinutes() / 5) * 5);
    return at;
};
