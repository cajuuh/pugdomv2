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
