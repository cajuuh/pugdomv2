import apiClient, { publicClient } from '../api/client';
import { FeedDescriptor } from './feedTypes';
import { fetchHomeTimeline, fetchPublicTimeline, fetchNewerPosts, NEW_POSTS_LIMIT } from './timeline';
import { getTrendingStatuses } from './trends';
import { getTagTimeline, TagTimelineOptions } from './tags';
import { Status } from './types';
import { getServerTimeline, serverUrl } from './servers';

export interface FeedRange {
    max_id?: string;
    min_id?: string;
    since_id?: string;
    limit?: number;
}

// Feeds paged by post id, which can load around a gap. Trending pages by offset.
export const canPageById = (feed: FeedDescriptor) => feed.kind !== 'trending';

// Posts between ids, newest first: max_id (older than), since_id (the newest above it) or
// min_id (the ones just above it)
export async function fetchFeedRange(feed: FeedDescriptor, range: FeedRange): Promise<Status[]> {
    const get = async (path: string, params: object = {}) =>
        (await apiClient.get<Status[]>(path, { params: { ...params, ...range } })).data;
    switch (feed.kind) {
        case 'home':
            return get('/timelines/home');
        case 'local':
            return get('/timelines/public', { local: true });
        case 'federated':
            return get('/timelines/public');
        case 'list':
            return feed.listId ? get(`/timelines/list/${feed.listId}`) : [];
        case 'hashtag':
            return feed.criteria?.tag
                ? get(`/timelines/tag/${encodeURIComponent(feed.criteria.tag)}`, { any: feed.criteria.any, all: feed.criteria.all, none: feed.criteria.none })
                : [];
        case 'server':
            return feed.domain
                ? (await publicClient.get<Status[]>(serverUrl(feed.domain, '/v1/timelines/public'), { params: { local: true, ...range } })).data
                : [];
        default:
            return [];
    }
}

// Direct posts (Mastodon puts the ones mentioning you in Home and lists) belong in Messages only
export const withoutDirect = (posts: Status[]): Status[] => posts.filter(post => post.visibility !== 'direct');

// Home's "show boosts" and "show replies", as in Mastodon's web app: hidden replies still show when
// they're to you. Mastodon can't filter Home itself, so it's done on the posts that arrive.
export const homeShows = (boosts: boolean, replies: boolean, me?: string) => (post: Status) =>
    (boosts || !post.reblog) && (replies || !post.in_reply_to_id || post.in_reply_to_account_id === me);

export const parseTrendingOffset = (cursor?: string): number => {
    if (cursor && cursor.startsWith('offset:')) {
        const val = parseInt(cursor.slice(7), 10);
        return isNaN(val) ? 0 : val;
    }
    return 0;
};

// A list's posts, newest first; sinceId for checking what's new
export async function getListTimeline(listId: string, maxId?: string, sinceId?: string): Promise<Status[]> {
    const response = await apiClient.get<Status[]>(`/timelines/list/${listId}`, {
        params: { max_id: maxId, since_id: sinceId, limit: sinceId ? NEW_POSTS_LIMIT : undefined },
    });
    return response.data;
}

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
        case 'list':
            return feed.listId ? getListTimeline(feed.listId, pageParam) : [];
        case 'server':
            return feed.domain ? getServerTimeline(feed.domain, pageParam) : [];
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
        case 'list':
            return feed.listId ? getListTimeline(feed.listId, undefined, sinceId) : [];
        case 'server':
            return feed.domain ? getServerTimeline(feed.domain, undefined, sinceId, NEW_POSTS_LIMIT) : [];
        case 'trending':
        default:
            return [];
    }
}
