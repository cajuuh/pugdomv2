import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils/queryClient';
import { plainText, withoutQuoteInline } from '../services/htmlText';
import { quoteView } from '../services/mastodon/quotes';
import { resolveStatus } from '../services/mastodon/search';
import { TootCard } from '../components/TootCard/tootCard';
import { MediaViewerProvider } from '../components/MediaViewer/mediaViewer';
import { NavigationProvider, useNavigator } from '../services/navigationContext';
import { Account, Quote, Status } from '../services/mastodon/types';

jest.mock('../services/mastodon/search', () => ({
    ...jest.requireActual('../services/mastodon/search'),
    resolveStatus: jest.fn(),
    resolveAccount: jest.fn(),
}));
jest.mock('../services/themeContext', () => ({
    useTheme: () => jest.requireActual('../testUtils/theme').mockTheme,
}));
jest.mock('../services/settingsContext', () => ({
    useSettings: () => ({ compactMode: false, mediaAutoplay: false }),
}));
jest.mock('../services/composeContext', () => ({
    useCompose: () => ({ openCompose: jest.fn() }),
}));

const ana: Account = { id: 'ana', username: 'ana', acct: 'ana@art.social', display_name: 'Ana', avatar: '', emojis: [] };
const joon: Account = { id: 'joon', username: 'joon', acct: 'joon', display_name: 'Joon', avatar: '', emojis: [] };

const post = (id: string, extra: Partial<Status> = {}): Status =>
    ({
        id,
        created_at: new Date().toISOString(),
        in_reply_to_id: null,
        in_reply_to_account_id: null,
        sensitive: false,
        spoiler_text: '',
        visibility: 'public',
        language: 'en',
        uri: `https://home.social/statuses/${id}`,
        url: `https://home.social/@joon/${id}`,
        replies_count: 0,
        reblogs_count: 0,
        favourites_count: 0,
        content: `<p>post ${id}</p>`,
        reblog: null,
        account: joon,
        media_attachments: [],
        emojis: [],
        ...extra,
    }) as Status;

const quoted = post('q1', { account: ana, content: '<p>Pugs are the best</p>', url: 'https://art.social/@ana/109001' });
const quoting = (quote: Quote, extra: Partial<Status> = {}) =>
    post('s1', {
        content: '<p>So true</p><p class="quote-inline">RE: <a href="https://art.social/@ana/109001">art.social/@ana/q1</a></p>',
        quote,
        ...extra,
    });

const StackProbe = () => <Text testID="stack">{JSON.stringify(useNavigator().stack.map(entry => entry.route))}</Text>;
const renderCard = (status: Status, props: Partial<React.ComponentProps<typeof TootCard>> = {}) =>
    render(
        <QueryClientProvider client={createTestQueryClient()}>
            <NavigationProvider>
                <MediaViewerProvider>
                    <TootCard status={status} {...props} />
                    <StackProbe />
                </MediaViewerProvider>
            </NavigationProvider>
        </QueryClientProvider>
    );

beforeEach(() => jest.clearAllMocks());

describe('quote text', () => {
    it("hides Mastodon's RE: paragraph for apps that can't show quotes", () => {
        const html = '<p>So true</p><p class="quote-inline">RE: <a href="x">x</a></p>';
        expect(withoutQuoteInline(html)).toBe('<p>So true</p>');
        expect(plainText(html)).toBe('So true');
    });
});

describe('what a quote shows', () => {
    it('shows accepted quotes and explains the rest', () => {
        expect(quoteView({ state: 'accepted', quoted_status: quoted })).toEqual({ kind: 'post', status: quoted });
        expect(quoteView({ state: 'pending' })).toEqual({ kind: 'notice', notice: 'pending' });
        expect(quoteView({ state: 'revoked' })).toEqual({ kind: 'notice', notice: 'removed' });
        expect(quoteView({ state: 'rejected' })).toEqual({ kind: 'notice', notice: 'removed' });
        expect(quoteView({ state: 'deleted' })).toEqual({ kind: 'notice', notice: 'deleted' });
        // Blocked and muted come with the post, but it stays hidden
        expect(quoteView({ state: 'blocked_domain', quoted_status: quoted })).toEqual({ kind: 'notice', notice: 'blocked' });
        expect(quoteView({ state: 'muted_account', quoted_status: quoted })).toEqual({ kind: 'notice', notice: 'muted' });
        // States added later count as unauthorized
        expect(quoteView({ state: 'something_new' })).toEqual({ kind: 'notice', notice: 'unavailable' });
        expect(quoteView({ state: 'accepted', quoted_status_id: 'q1' })).toEqual({ kind: 'notice', notice: 'unavailable' });
        expect(quoteView(null)).toBeNull();
    });
});

describe('Quote posts', () => {
    it('shows the quoted post inside the post, and opens it', async () => {
        const onPress = jest.fn();
        await renderCard(quoting({ state: 'accepted', quoted_status: quoted }), { onPress });

        expect(screen.getByText('Pugs are the best')).toBeTruthy();
        expect(screen.getByText(/@ana@art.social/)).toBeTruthy();
        expect(screen.queryByText(/RE:/)).toBeNull();
        await fireEvent.press(screen.getByRole('button', { name: 'Quoted post by Ana: Pugs are the best' }));

        expect(onPress).toHaveBeenCalledWith('q1');
    });

    it('opens the quoted post in a thread when the card has no handler', async () => {
        await renderCard(quoting({ state: 'accepted', quoted_status: quoted }));

        await fireEvent.press(screen.getByRole('button', { name: /Quoted post by Ana/ }));

        expect(JSON.parse(screen.getByTestId('stack').props.children)).toEqual([{ name: 'thread', statusId: 'q1' }]);
    });

    it("keeps the quoted post's content warning, and its sensitive media, closed", async () => {
        const hidden = { ...quoted, spoiler_text: 'Spoilers', sensitive: true, media_attachments: [{ id: 'm1', type: 'image' as const, url: 'u', preview_url: 'p' }] };
        await renderCard(quoting({ state: 'accepted', quoted_status: hidden }));

        expect(screen.getByText('Spoilers')).toBeTruthy();
        expect(screen.queryByText('Pugs are the best')).toBeNull();
        expect(screen.getByText('Sensitive media')).toBeTruthy();
    });

    it('says when the quoted post quotes another', async () => {
        await renderCard(quoting({ state: 'accepted', quoted_status: { ...quoted, quote: { state: 'accepted', quoted_status_id: 'q0' } } }));
        expect(screen.getByText('Quotes another post')).toBeTruthy();
    });

    it.each([
        ['pending', 'Waiting for the author to approve this quote'],
        ['revoked', 'The author removed this quote'],
        ['deleted', 'The quoted post was deleted'],
        ['unauthorized', "You can't see the quoted post"],
        ['muted_account', 'Quoted post from someone you muted'],
    ])('explains a %s quote', async (state, text) => {
        await renderCard(quoting({ state, quoted_status: state === 'muted_account' ? quoted : null }));

        expect(screen.getByText(text)).toBeTruthy();
        expect(screen.queryByText('Pugs are the best')).toBeNull();
    });

    it('finds a quote in another server’s feed through our own server', async () => {
        (resolveStatus as jest.Mock).mockResolvedValue({ ...quoted, id: 'ours-q1' });
        await renderCard(quoting({ state: 'accepted', quoted_status: quoted }), { remote: true });

        await fireEvent.press(screen.getByRole('button', { name: /Quoted post by Ana/ }));

        await waitFor(() => expect(resolveStatus).toHaveBeenCalledWith('https://art.social/@ana/109001'));
        expect(JSON.parse(screen.getByTestId('stack').props.children)).toEqual([{ name: 'thread', statusId: 'ours-q1' }]);
    });

    it('shows nothing extra for posts without a quote', async () => {
        await renderCard(post('s2'));
        expect(screen.queryByRole('button', { name: /Quoted post/ })).toBeNull();
    });
});
