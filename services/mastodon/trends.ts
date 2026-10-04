import apiClient from '../api/client';
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
