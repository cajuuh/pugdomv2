import apiClient from '../api/client';
import { Status } from './types';

export interface TagHistory {
    day: string; // UNIX timestamp of the day, as a string
    uses: string;
    accounts: string;
}

export interface Tag {
    name: string;
    url: string;
    // Most recent day first
    history?: TagHistory[];
    following?: boolean;
}

// Narrows or widens a hashtag timeline with more tags (for multi-hashtag feeds)
export interface TagTimelineOptions {
    any?: string[];
    all?: string[];
    none?: string[];
}

const encode = (tag: string) => encodeURIComponent(tag);

export async function getTag(name: string): Promise<Tag> {
    const response = await apiClient.get<Tag>(`/tags/${encode(name)}`);
    return response.data;
}

export async function followTag(name: string): Promise<Tag> {
    const response = await apiClient.post<Tag>(`/tags/${encode(name)}/follow`);
    return response.data;
}

export async function unfollowTag(name: string): Promise<Tag> {
    const response = await apiClient.post<Tag>(`/tags/${encode(name)}/unfollow`);
    return response.data;
}

// axios sends arrays as any[]=a&any[]=b, which is what Mastodon expects
export async function getTagTimeline(tag: string, maxId?: string, options: TagTimelineOptions = {}): Promise<Status[]> {
    const response = await apiClient.get<Status[]>(`/timelines/tag/${encode(tag)}`, {
        params: { max_id: maxId, ...options },
    });
    return response.data;
}

// Posts and people using the tag over the last week (history is per day, newest first)
export const weeklyUsage = (tag?: Pick<Tag, 'history'>) =>
    (tag?.history ?? []).slice(0, 7).reduce(
        (total, day) => ({ posts: total.posts + Number(day.uses || 0), people: total.people + Number(day.accounts || 0) }),
        { posts: 0, people: 0 }
    );

// The tag in a hashtag link: https://server/tags/caf%C3%A9 → café
export const tagFromHref = (href: string) => {
    const last = href.replace(/[?#].*$/, '').replace(/\/$/, '').split('/').pop() ?? '';
    try {
        return decodeURIComponent(last).replace(/^#/, '');
    } catch {
        return last.replace(/^#/, '');
    }
};
