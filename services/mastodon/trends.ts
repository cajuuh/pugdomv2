import apiClient, { publicClient } from '../api/client';
import { getCredentials } from '../storage';
import { Tag } from './tags';
import { Account, PreviewCard, Status } from './types';

export interface TrendHistory {
    day: string;
    accounts: string;
    uses: string;
}

export interface TrendLink extends PreviewCard {
    history?: TrendHistory[];
}

export interface SuggestionV2 {
    source?: string;
    account: Account;
}

// 7-day usage for a trending link: { uses: number, people: number }
export const weeklyTrendUsage = (history?: TrendHistory[]) =>
    (history ?? []).slice(0, 7).reduce(
        (total, day) => ({
            uses: total.uses + Number(day.uses || 0),
            people: total.people + Number(day.accounts || 0),
        }),
        { uses: 0, people: 0 }
    );

// Trending statuses: GET /api/v1/trends/statuses
export async function getTrendingStatuses(limit = 20, offset?: number): Promise<Status[]> {
    try {
        const response = await apiClient.get<Status[]>('/trends/statuses', {
            params: { limit, offset: offset || undefined },
        });
        return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
        if (error?.response?.status === 404 || error?.response?.status === 403) {
            return [];
        }
        throw error;
    }
}

// Big public servers whose trends join our server's in Trending: each server only counts the engagement it sees
export const TRENDING_SERVERS = ['mastodon.social', 'mas.to', 'mastodon.online', 'fosstodon.org'];

// Another server's trending posts, read without an account; a server that fails just adds nothing
export async function getServerTrendingStatuses(domain: string, limit = 20): Promise<Status[]> {
    try {
        const { data } = await publicClient.get<Status[]>(`https://${domain}/api/v1/trends/statuses`, { params: { limit } });
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

export interface TrendingPost {
    status: Status;
    // Read from another server: its ids aren't ours, so the card opens it through our server
    remote: boolean;
}

const engagement = (status: Status) => status.favourites_count + status.reblogs_count + status.replies_count;

// One list from every server's trends. Our server's copy of a post wins (it can be acted on here);
// ranked by its best engagement times how many servers trend it.
export function mergeTrending(local: Status[], others: Status[][]): TrendingPost[] {
    const byUri = new Map<string, TrendingPost & { best: number; servers: number }>();
    const add = (list: Status[], remote: boolean) =>
        list.forEach(status => {
            const seen = byUri.get(status.uri);
            if (seen) {
                seen.servers += 1;
                seen.best = Math.max(seen.best, engagement(status));
            } else {
                byUri.set(status.uri, { status, remote, best: engagement(status), servers: 1 });
            }
        });
    add(local, false);
    others.forEach(list => add(list, true));
    return [...byUri.values()]
        .sort((a, b) => b.best * b.servers - a.best * a.servers)
        .map(({ status, remote }) => ({ status, remote }));
}

// Trending hashtags: GET /api/v1/trends/tags
export async function getTrendingTags(limit = 10, offset?: number): Promise<Tag[]> {
    try {
        const response = await apiClient.get<Tag[]>('/trends/tags', {
            params: { limit, offset: offset || undefined },
        });
        return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
        if (error?.response?.status === 404 || error?.response?.status === 403) {
            return [];
        }
        throw error;
    }
}

// Trending news links: GET /api/v1/trends/links
export async function getTrendingLinks(limit = 10, offset?: number): Promise<TrendLink[]> {
    try {
        const response = await apiClient.get<TrendLink[]>('/trends/links', {
            params: { limit, offset: offset || undefined },
        });
        return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
        if (error?.response?.status === 404 || error?.response?.status === 403) {
            return [];
        }
        throw error;
    }
}

// Follow suggestions: GET /api/v2/suggestions (with v1 fallback)
export async function getSuggestions(limit = 20): Promise<Account[]> {
    const { instanceUrl } = await getCredentials();
    if (!instanceUrl) return [];

    try {
        // v2 needs absolute URL because apiClient baseURL is /api/v1
        const response = await apiClient.get<Array<SuggestionV2 | Account>>(`${instanceUrl}/api/v2/suggestions`, {
            params: { limit },
        });
        if (Array.isArray(response.data)) {
            return response.data.map(item => ('account' in item && item.account ? item.account : (item as Account)));
        }
        return [];
    } catch (error: any) {
        if (error?.response?.status === 404) {
            // Fallback to v1 suggestions
            try {
                const v1Response = await apiClient.get<Account[]>('/suggestions', {
                    params: { limit },
                });
                return Array.isArray(v1Response.data) ? v1Response.data : [];
            } catch {
                return [];
            }
        }
        if (error?.response?.status === 403) return [];
        throw error;
    }
}

// Link timeline: GET /api/v1/timelines/link?url=... (Mastodon 4.3+)
export async function getLinkTimeline(url: string, maxId?: string, limit = 20): Promise<Status[]> {
    const response = await apiClient.get<Status[]>('/timelines/link', {
        params: { url, max_id: maxId, limit },
    });
    return Array.isArray(response.data) ? response.data : [];
}
