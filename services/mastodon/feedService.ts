import apiClient from '../api/client';
import { FeedDescriptor } from './feedTypes';
import { fetchHomeTimeline, fetchPublicTimeline, fetchNewerPosts, NEW_POSTS_LIMIT } from './timeline';
import { getTrendingStatuses } from './trends';
import { getTagTimeline, TagTimelineOptions } from './tags';
import { Status } from './types';

export const parseTrendingOffset = (cursor?: string): number => {
    if (cursor && cursor.startsWith('offset:')) {
        const val = parseInt(cursor.slice(7), 10);
        return isNaN(val) ? 0 : val;
    }
    return 0;
};

export async function fetchFeedPage(feed: FeedDescriptor, pageParam?: string): Promise<Status[]> {
    switch (feed.kind) {
        case 'home':
            return fetchHomeTimeline(pageParam);
        case 'local':
            return fetchPublicTimeline(pageParam, true);
        case 'federated':
            return fetchPublicTimeline(pageParam, false);
        case 'trending': {
            const offset = parseTrendingOffset(pageParam);
            return getTrendingStatuses(20, offset || undefined);
        }
        case 'hashtag': {
            if (!feed.criteria?.tag) return [];
            const options: TagTimelineOptions = {
                any: feed.criteria.any,
                all: feed.criteria.all,
                none: feed.criteria.none,
            };
            return getTagTimeline(feed.criteria.tag, pageParam, options);
        }
        default:
            return [];
    }
}

export async function fetchFeedNewer(feed: FeedDescriptor, sinceId: string): Promise<Status[]> {
    switch (feed.kind) {
        case 'home':
        case 'local':
        case 'federated':
            return fetchNewerPosts(feed.kind, sinceId);
        case 'hashtag': {
            if (!feed.criteria?.tag) return [];
            try {
                const response = await apiClient.get<Status[]>(`/timelines/tag/${encodeURIComponent(feed.criteria.tag)}`, {
                    params: {
                        since_id: sinceId,
                        limit: NEW_POSTS_LIMIT,
                        any: feed.criteria.any,
                        all: feed.criteria.all,
                        none: feed.criteria.none,
                    },
                });
                return Array.isArray(response.data) ? response.data : [];
            } catch {
                return [];
            }
        }
        case 'trending':
        default:
            return [];
    }
}
