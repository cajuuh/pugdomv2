import apiClient from '../api/client';
import { Translator } from '../i18n/translate';
import { Account, Quote, Status } from './types';

// Why a quote can't be shown
export type QuoteNotice = 'pending' | 'removed' | 'deleted' | 'unavailable' | 'blocked' | 'muted';

export type QuoteView = { kind: 'post'; status: Status } | { kind: 'notice'; notice: QuoteNotice };

// What a post's quote shows: the quoted post when it's accepted, otherwise why not. Blocked and muted
// quotes come with the post, but it stays hidden, as on Mastodon's web app.
export const quoteView = (quote?: Quote | null): QuoteView | null => {
    if (!quote) return null;
    switch (quote.state) {
        case 'accepted':
            return quote.quoted_status ? { kind: 'post', status: quote.quoted_status } : { kind: 'notice', notice: 'unavailable' };
        case 'pending':
            return { kind: 'notice', notice: 'pending' };
        case 'rejected':
        case 'revoked':
            return { kind: 'notice', notice: 'removed' };
        case 'deleted':
            return { kind: 'notice', notice: 'deleted' };
        case 'blocked_account':
        case 'blocked_domain':
            return { kind: 'notice', notice: 'blocked' };
        case 'muted_account':
            return { kind: 'notice', notice: 'muted' };
        default:
            return { kind: 'notice', notice: 'unavailable' };
    }
};

// Who can quote a post you write (Mastodon's quote_approval_policy)
export type QuotePolicy = 'public' | 'followers' | 'nobody';

// The choices for who can quote a post, for pickers
export const quotePolicies = ({ t }: Translator): { value: QuotePolicy; label: string; description: string; icon: 'globe-outline' | 'people-outline' | 'lock-closed-outline' }[] => [
    { value: 'public', label: t('compose.quoteAnyone'), description: t('compose.quoteAnyoneDescription'), icon: 'globe-outline' },
    { value: 'followers', label: t('compose.quoteFollowers'), description: t('compose.quoteFollowersDescription'), icon: 'people-outline' },
    { value: 'nobody', label: t('compose.quoteNobody'), description: t('compose.quoteNobodyDescription'), icon: 'lock-closed-outline' },
];

// Whether you can quote a post: `manual` means its author has to approve the quote first.
// Null when the server has no quote posts (it sends no quote_approval).
export const quotePermission = (status: Status, me?: Pick<Account, 'id'> | null): 'automatic' | 'manual' | 'denied' | null => {
    // Private mentions can never be quoted
    if (status.visibility === 'direct') return status.quote_approval ? 'denied' : null;
    // Authors can always quote their own posts
    if (me && status.account.id === me.id) return status.quote_approval ? 'automatic' : null;
    switch (status.quote_approval?.current_user) {
        case undefined:
            return null;
        case 'automatic':
            return 'automatic';
        case 'manual':
            return 'manual';
        // `unknown` means policies Mastodon doesn't support; treated as denied
        default:
            return 'denied';
    }
};

// Followers-only and private posts can't be quoted by others, whatever the setting
export const effectiveQuotePolicy = (policy: QuotePolicy, visibility: Status['visibility']): QuotePolicy =>
    visibility === 'private' || visibility === 'direct' ? 'nobody' : policy;

// Who can quote a published post, read back from its quote_approval
export const currentQuotePolicy = (status: Status): QuotePolicy => {
    const allowed = [...(status.quote_approval?.automatic ?? []), ...(status.quote_approval?.manual ?? [])];
    if (allowed.includes('public')) return 'public';
    if (allowed.includes('followers')) return 'followers';
    return 'nobody';
};

export interface QuotesPage {
    statuses: Status[];
    // Older quotes, from the Link header; none when this is the last page
    nextMaxId?: string;
}

// The max_id of a Link header's rel="next" URL
export const nextMaxIdFromLink = (link?: string | null) => {
    const next = link?.split(',').find(part => /rel="next"/.test(part));
    return next?.match(/[?&]max_id=([^&>]+)/)?.[1];
};

// Posts quoting a post, newest first; paged with the Link header, since their ids aren't the quoted post's
export async function getQuotes(statusId: string, maxId?: string): Promise<QuotesPage> {
    const response = await apiClient.get<Status[]>(`/statuses/${statusId}/quotes`, { params: { max_id: maxId } });
    return { statuses: response.data, nextMaxId: nextMaxIdFromLink(response.headers?.link) };
}

// Detaches someone's quote from your post
export async function revokeQuote(statusId: string, quotingStatusId: string): Promise<Status> {
    const response = await apiClient.post<Status>(`/statuses/${statusId}/quotes/${quotingStatusId}/revoke`);
    return response.data;
}

// Changes who can quote one of your posts from now on (earlier quotes stay)
export async function setQuotePolicy(statusId: string, policy: QuotePolicy): Promise<Status> {
    const response = await apiClient.put<Status>(`/statuses/${statusId}/interaction_policy`, { quote_approval_policy: policy });
    return response.data;
}
