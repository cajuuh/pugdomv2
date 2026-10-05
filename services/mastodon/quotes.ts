import { Quote, Status } from './types';

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
