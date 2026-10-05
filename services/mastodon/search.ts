import apiClient from '../api/client';
import { getCredentials } from '../storage';
import { Tag } from './tags';
import { Account, Status } from './types';

export type SearchType = 'accounts' | 'hashtags' | 'statuses';

export interface SearchResults {
    accounts: Account[];
    hashtags: Tag[];
    statuses: Status[];
}

export interface SearchParams {
    q: string;
    type?: SearchType;
    // Ask our server to fetch unknown accounts / posts (WebFinger, URLs). Slow, so not on every keystroke.
    resolve?: boolean;
    limit?: number;
    // Paging; Mastodon only allows it together with a type
    offset?: number;
}

const EMPTY: SearchResults = { accounts: [], hashtags: [], statuses: [] };

export async function search({ q, type, resolve, limit, offset }: SearchParams): Promise<SearchResults> {
    // apiClient's base URL is /api/v1, so the v2 endpoint needs the full URL
    const { instanceUrl } = await getCredentials();
    if (!instanceUrl) return EMPTY;
    const response = await apiClient.get<SearchResults>(`${instanceUrl}/api/v2/search`, {
        params: { q, type, resolve: resolve || undefined, limit, offset },
    });
    return { ...EMPTY, ...response.data };
}

// Finds the account behind a profile URL or @user@server, asking our server to look it up (WebFinger)
// if it doesn't know it yet. Null when nothing matches.
export async function resolveAccount(query: string): Promise<Account | null> {
    const results = await search({ q: query, type: 'accounts', resolve: true, limit: 1 });
    return results.accounts[0] ?? null;
}

// Finds a post from any server by its URL, asking our server to fetch it. Null when it can't.
export async function resolveStatus(url: string): Promise<Status | null> {
    const results = await search({ q: url, type: 'statuses', resolve: true, limit: 1 });
    return results.statuses[0] ?? null;
}

// Links that look like a post or a profile on Mastodon and friends (Pleroma / Akkoma, Misskey, GoToSocial…)
const POST_PATH = /\/(?:@[\w.-]+(?:@[\w.-]+)?\/\d+|users\/[\w.-]+\/statuses\/\w+|notice\/\w+|notes\/\w+|objects\/[\w-]+)\/?$/;
const PROFILE_PATH = /\/(?:@[\w.-]+(?:@[\w.-]+)?|users\/[\w.-]+)\/?$/;

export const fediverseLinkKind = (href: string): 'post' | 'profile' | null => {
    const match = href.match(/^https?:\/\/[^/?#]+(\/[^?#]*)?(?:[?#].*)?$/i);
    const path = match?.[1] ?? '';
    if (POST_PATH.test(path)) return 'post';
    if (PROFILE_PATH.test(path)) return 'profile';
    return null;
};

// Queries worth asking our server to look up: @user@server, or a link to a profile or post
export const shouldResolve = (q: string) => /^@?[\w.-]+@[\w-]+(\.[\w-]+)+$/.test(q.trim()) || /^https?:\/\/\S+$/i.test(q.trim());
