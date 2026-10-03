import apiClient from "../api/client";
import { Status } from "./types";

export async function fetchHomeTimeline(maxId?: string) {
    const response = await apiClient.get('/timelines/home', {
        params: { max_id: maxId },
    });
    return response.data;
}

export async function fetchPublicTimeline(maxId?: string, local?: boolean) {
    const response = await apiClient.get('/timelines/public', {
        params: { max_id: maxId, local: local ? true : undefined },
    });
    return response.data;
}

export type FeedType = 'home' | 'local' | 'federated';

// Posts newer than `sinceId` (newest first, up to `limit`), for counting what arrived since the list loaded
export async function fetchNewerPosts(feed: FeedType, sinceId: string, limit = NEW_POSTS_LIMIT): Promise<Status[]> {
    const response = await apiClient.get(feed === 'home' ? '/timelines/home' : '/timelines/public', {
        params: { since_id: sinceId, limit, local: feed === 'local' ? true : undefined },
    });
    return response.data;
}

// Mastodon's page cap; more than this shows as "40+"
export const NEW_POSTS_LIMIT = 40;
