import apiClient from '../api/client';
import { getCredentials } from '../storage';
import { Filter, FilterAction, FilterContext, Status } from './types';
import { FeedKind } from './feedTypes';

export interface FilterMatch {
    action: FilterAction;
    // The titles of the filters that cover the post (warn)
    titles: string[];
}

const STRENGTH: Record<FilterAction, number> = { blur: 1, warn: 2, hide: 3 };

// What your filters do to a post shown in `context`, as Mastodon's web app decides it: only filters for that
// context that haven't expired count, a boost counts its own results and the boosted post's, and the strongest
// action wins.
export const filterMatch = (status: Status, context: FilterContext | undefined, now = Date.now()): FilterMatch | null => {
    if (!context) return null;
    const results = [...(status.filtered ?? []), ...(status.reblog?.filtered ?? [])];
    const filters = results
        .map(result => result.filter)
        .filter(filter => filter.context.includes(context) && !(filter.expires_at && Date.parse(filter.expires_at) <= now));
    if (filters.length === 0) return null;
    const action = filters.reduce<FilterAction>((best, f) => (STRENGTH[f.filter_action] > STRENGTH[best] ? f.filter_action : best), 'blur');
    return { action, titles: filters.filter(f => f.filter_action === 'warn').map(f => f.title) };
};

// Posts a hide filter for `context` doesn't drop
export const withoutHidden = (posts: Status[], context: FilterContext | undefined): Status[] =>
    context ? posts.filter(post => filterMatch(post, context)?.action !== 'hide') : posts;

// Home and lists use Home's filters; another server's timeline has none of yours
export const feedFilterContext = (kind: FeedKind): FilterContext | undefined =>
    kind === 'home' || kind === 'list' ? 'home' : kind === 'server' ? undefined : 'public';

// What the editor sends. A keyword with an id is changed (or removed with `_destroy`), one without is added.
export interface FilterFields {
    title: string;
    context: FilterContext[];
    filter_action: FilterAction;
    // Seconds from now; '' never expires; left out, it stays as it is
    expires_in?: number | '';
    keywords_attributes: { id?: string; keyword?: string; whole_word?: boolean; _destroy?: boolean }[];
}

// apiClient's base URL is /api/v1; filters are under /api/v2
const filtersUrl = async (id?: string) => {
    const { instanceUrl } = await getCredentials();
    return `${instanceUrl}/api/v2/filters${id ? `/${id}` : ''}`;
};

export async function getFilters(): Promise<Filter[]> {
    const response = await apiClient.get<Filter[]>(await filtersUrl());
    return response.data;
}

export async function createFilter(fields: FilterFields): Promise<Filter> {
    const response = await apiClient.post<Filter>(await filtersUrl(), fields);
    return response.data;
}

export async function updateFilter(id: string, fields: FilterFields): Promise<Filter> {
    const response = await apiClient.put<Filter>(await filtersUrl(id), fields);
    return response.data;
}

export async function deleteFilter(id: string): Promise<void> {
    await apiClient.delete(await filtersUrl(id));
}
