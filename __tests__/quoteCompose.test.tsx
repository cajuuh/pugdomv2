import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils/queryClient';
import { effectiveQuotePolicy, quotePermission } from '../services/mastodon/quotes';
import { DEFAULT_INSTANCE_CONFIGURATION, fetchInstanceConfiguration } from '../services/mastodon/instance';
import { createStatus, reblogStatus } from '../services/mastodon/statuses';
import ComposeModal, { defaultVisibility } from '../components/ComposeModal/composeModal';
import { TootCard } from '../components/TootCard/tootCard';
import { MediaViewerProvider } from '../components/MediaViewer/mediaViewer';
import { Account, QuoteApproval, Status } from '../services/mastodon/types';

const me: Account = { id: 'me', username: 'me', acct: 'me', display_name: 'Me', avatar: '', emojis: [], source: { quote_policy: 'public' } };
const ana: Account = { id: 'ana', username: 'ana', acct: 'ana', display_name: 'Ana', avatar: '', emojis: [] };

const mockOpenCompose = jest.fn();
jest.mock('../services/authContext', () => ({ useAuth: () => ({ user: me }), useOptionalAuth: () => ({ user: me }) }));
jest.mock('../services/themeContext', () => ({
    useTheme: () => jest.requireActual('../testUtils/theme').mockTheme,
}));
jest.mock('../services/settingsContext', () => ({
    useSettings: () => ({ compactMode: false, mediaAutoplay: false }),
}));
jest.mock('../services/composeContext', () => ({
    useCompose: () => ({ openCompose: mockOpenCompose }),
}));
jest.mock('../services/mastodon/statuses', () => ({
    createStatus: jest.fn(),
    reblogStatus: jest.fn(),
    unreblogStatus: jest.fn(),
    favouriteStatus: jest.fn(),
    unfavouriteStatus: jest.fn(),
    bookmarkStatus: jest.fn(),
    unbookmarkStatus: jest.fn(),
}));
jest.mock('../services/mastodon/customEmojis', () => ({ fetchCustomEmojis: jest.fn(async () => []) }));
jest.mock('../services/mastodon/instance', () => ({
    ...jest.requireActual('../services/mastodon/instance'),
    fetchInstanceConfiguration: jest.fn(),
}));

const approval = (current_user: QuoteApproval['current_user']): QuoteApproval => ({ automatic: ['public'], manual: [], current_user });
const post = (extra: Partial<Status> = {}): Status =>
    ({
        id: 'p1',
        created_at: new Date().toISOString(),
        in_reply_to_id: null,
        in_reply_to_account_id: null,
        sensitive: false,
        spoiler_text: '',
        visibility: 'public',
        language: 'en',
        uri: 'https://home.social/statuses/p1',
        url: 'https://home.social/@ana/p1',
        replies_count: 0,
        reblogs_count: 2,
        favourites_count: 0,
        content: '<p>Pugs are the best</p>',
        reblog: null,
        account: ana,
        media_attachments: [],
        emojis: [],
        ...extra,
    }) as Status;

beforeEach(() => {
    jest.clearAllMocks();
    (createStatus as jest.Mock).mockResolvedValue({});
    (reblogStatus as jest.Mock).mockImplementation(async () => ({ ...post(), reblogged: true }));
    (fetchInstanceConfiguration as jest.Mock).mockResolvedValue({ ...DEFAULT_INSTANCE_CONFIGURATION, supportsQuotes: true });
});

describe('who can quote', () => {
    it("follows the post's approval for the person looking", () => {
        expect(quotePermission(post({ quote_approval: approval('automatic') }))).toBe('automatic');
        expect(quotePermission(post({ quote_approval: approval('manual') }))).toBe('manual');
        expect(quotePermission(post({ quote_approval: approval('denied') }))).toBe('denied');
        // Policies Mastodon doesn't support count as denied
        expect(quotePermission(post({ quote_approval: approval('unknown') }))).toBe('denied');
        // Servers without quotes send no approval
        expect(quotePermission(post())).toBeNull();
    });

    it('never quotes private mentions, and always lets authors quote their own posts', () => {
        expect(quotePermission(post({ visibility: 'direct', quote_approval: approval('automatic') }))).toBe('denied');
        expect(quotePermission(post({ account: me, quote_approval: approval('denied') }), me)).toBe('automatic');
    });

    it('lets nobody else quote followers-only and private posts', () => {
        expect(effectiveQuotePolicy('public', 'unlisted')).toBe('public');
        expect(effectiveQuotePolicy('followers', 'private')).toBe('nobody');
        expect(effectiveQuotePolicy('public', 'direct')).toBe('nobody');
    });

    it('makes a quote of a followers-only post followers-only too', () => {
        expect(defaultVisibility(me, null, post({ visibility: 'private' }))).toBe('private');
        expect(defaultVisibility({ ...me, source: { privacy: 'direct' } }, null, post({ visibility: 'private' }))).toBe('direct');
        expect(defaultVisibility(me, null, post())).toBe('public');
    });
});

describe('Boost menu', () => {
    const renderCard = (status: Status) =>
        render(
            <QueryClientProvider client={createTestQueryClient()}>
                <MediaViewerProvider>
                    <TootCard status={status} />
                </MediaViewerProvider>
            </QueryClientProvider>
        );
    const boostButton = () => screen.getByRole('button', { name: /^Boost, 2 boosts/ });

    it('boosts straight away on servers without quotes', async () => {
        await renderCard(post());
        await fireEvent.press(boostButton());

        expect(reblogStatus).toHaveBeenCalledWith('p1');
        expect(screen.queryByText('Boost or quote')).toBeNull();
    });

    it('offers boosting or quoting, and quoting opens compose with the post', async () => {
        const status = post({ quote_approval: approval('automatic') });
        await renderCard(status);

        await fireEvent.press(boostButton());
        expect(await screen.findByRole('header', { name: 'Boost or quote' })).toBeTruthy();
        await fireEvent.press(screen.getByRole('button', { name: 'Quote' }));

        await waitFor(() => expect(mockOpenCompose).toHaveBeenCalledWith({ quoteStatus: status }));
        expect(reblogStatus).not.toHaveBeenCalled();
    });

    it('boosts from the menu', async () => {
        await renderCard(post({ quote_approval: approval('automatic') }));

        await fireEvent.press(boostButton());
        await fireEvent.press(await screen.findByRole('button', { name: 'Boost' }));

        expect(reblogStatus).toHaveBeenCalledWith('p1');
    });

    it('explains when the author has to approve, or does not allow it', async () => {
        const { rerender } = await renderCard(post({ quote_approval: approval('manual') }));
        await fireEvent.press(boostButton());
        expect((await screen.findByRole('button', { name: 'Quote' })).props.accessibilityHint).toBe('The author has to approve your quote');

        await rerender(
            <QueryClientProvider client={createTestQueryClient()}>
                <MediaViewerProvider>
                    <TootCard status={post({ id: 'p2', quote_approval: approval('denied') })} />
                </MediaViewerProvider>
            </QueryClientProvider>
        );
        await fireEvent.press(screen.getByRole('button', { name: /^Boost, 2 boosts/ }));
        const quote = await screen.findByRole('button', { name: 'Quote' });
        expect(quote).toBeDisabled();
        expect(quote.props.accessibilityHint).toBe("The author doesn't allow you to quote this post");
    });
});

describe('Quoting in compose', () => {
    const renderCompose = (quoteStatus: Status | null) =>
        render(
            <QueryClientProvider client={createTestQueryClient()}>
                <ComposeModal isOpen replyToStatus={null} quoteStatus={quoteStatus} closeCompose={jest.fn()} />
            </QueryClientProvider>
        );
    const write = (text: string) => fireEvent.changeText(screen.getByLabelText('Post text'), text);

    it('shows the quoted post and sends it with who can quote', async () => {
        await renderCompose(post());

        expect(screen.getByRole('header', { name: 'Quote' })).toBeTruthy();
        expect(screen.getByText('Pugs are the best')).toBeTruthy();
        await screen.findByRole('button', { name: 'Who can quote: Anyone' });
        await write('So true');
        await fireEvent.press(screen.getByRole('button', { name: 'Post' }));

        expect(createStatus).toHaveBeenCalledWith(expect.objectContaining({ status: 'So true', quoted_status_id: 'p1', quote_approval_policy: 'public' }));
    });

    it('lets you choose who can quote your post', async () => {
        await renderCompose(null);

        await fireEvent.press(await screen.findByRole('button', { name: 'Who can quote: Anyone' }));
        await fireEvent.press(screen.getByRole('radio', { name: /^Followers/ }));
        await write('Hello');
        await fireEvent.press(screen.getByRole('button', { name: 'Post' }));

        expect(createStatus).toHaveBeenCalledWith(expect.objectContaining({ quoted_status_id: undefined, quote_approval_policy: 'followers' }));
    });

    it('keeps a quote of a followers-only post followers-only, and unquotable', async () => {
        await renderCompose(post({ visibility: 'private' }));

        expect(screen.getByRole('button', { name: 'Visibility: Followers' })).toBeTruthy();
        expect(screen.getByText(/so yours is followers-only too/)).toBeTruthy();
        expect(await screen.findByRole('button', { name: 'Who can quote: Just you' })).toBeDisabled();
        await write('Yes');
        await fireEvent.press(screen.getByRole('button', { name: 'Post' }));

        expect(createStatus).toHaveBeenCalledWith(expect.objectContaining({ visibility: 'private', quote_approval_policy: 'nobody' }));
    });

    it('drops the quote with ✕', async () => {
        await renderCompose(post());

        await fireEvent.press(screen.getByRole('button', { name: 'Remove the quote' }));
        expect(screen.queryByText('Pugs are the best')).toBeNull();
        await write('Never mind');
        await fireEvent.press(screen.getByRole('button', { name: 'Post' }));

        expect(createStatus).toHaveBeenCalledWith(expect.objectContaining({ quoted_status_id: undefined }));
    });

    it("doesn't send quote settings to servers without quotes", async () => {
        (fetchInstanceConfiguration as jest.Mock).mockResolvedValue({ ...DEFAULT_INSTANCE_CONFIGURATION, supportsQuotes: false });
        await renderCompose(null);
        await screen.findByText(String(DEFAULT_INSTANCE_CONFIGURATION.maxCharacters));

        expect(screen.queryByRole('button', { name: /Who can quote/ })).toBeNull();
        await write('Hi');
        await fireEvent.press(screen.getByRole('button', { name: 'Post' }));

        expect(createStatus).toHaveBeenCalledWith(expect.objectContaining({ quote_approval_policy: undefined }));
    });
});
