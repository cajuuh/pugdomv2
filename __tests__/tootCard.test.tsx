import React from 'react';
import { Alert, Platform, Share, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils/queryClient';
import { MediaViewerProvider } from '../components/MediaViewer/mediaViewer';
import { NavigationProvider, useNavigator } from '../services/navigationContext';
import { TootCard, describeHidden } from '../components/TootCard/tootCard';
import { COMPACT_ACTION_HEIGHT } from '../components/TootCard/styles';
import { MIN_TOUCH } from '../services/theme/shape';
import { Poll } from '../components/Poll/poll';
import { bookmarkStatus, favouriteStatus, unbookmarkStatus } from '../services/mastodon/statuses';
import { votePoll } from '../services/mastodon/polls';
import { Attachment, Poll as PollType, Status } from '../services/mastodon/types';

jest.mock('../services/mastodon/statuses', () => ({
    favouriteStatus: jest.fn(),
    unfavouriteStatus: jest.fn(),
    reblogStatus: jest.fn(),
    unreblogStatus: jest.fn(),
    bookmarkStatus: jest.fn(),
    unbookmarkStatus: jest.fn(),
}));

jest.mock('../services/mastodon/polls', () => ({
    votePoll: jest.fn(),
}));

// Mutable so the Compact Mode tests can turn it on
const mockSettings = { compactMode: false, mediaAutoplay: false, hideCounts: false };
jest.mock('../services/settingsContext', () => ({
    useSettings: () => mockSettings,
}));

jest.mock('../services/themeContext', () => ({
    useTheme: () => jest.requireActual('../testUtils/theme').mockTheme,
}));

jest.mock('../services/composeContext', () => ({
    useCompose: () => ({ openCompose: jest.fn() }),
}));

const mockedFavourite = favouriteStatus as jest.MockedFunction<typeof favouriteStatus>;
const mockedBookmark = bookmarkStatus as jest.MockedFunction<typeof bookmarkStatus>;
const mockedUnbookmark = unbookmarkStatus as jest.MockedFunction<typeof unbookmarkStatus>;
const mockedVote = votePoll as jest.MockedFunction<typeof votePoll>;

const makeStatus = (id: string, counts: { replies: number; boosts: number; favs: number }, favourited = false): Status => ({
    id,
    created_at: new Date().toISOString(),
    in_reply_to_id: null,
    in_reply_to_account_id: null,
    sensitive: false,
    spoiler_text: '',
    visibility: 'public',
    language: 'en',
    uri: `https://example.social/statuses/${id}`,
    url: `https://example.social/@user/${id}`,
    replies_count: counts.replies,
    reblogs_count: counts.boosts,
    favourites_count: counts.favs,
    content: `<p>status ${id}</p>`,
    reblog: null,
    account: { id: 'a1', username: 'user', acct: 'user', display_name: 'User', avatar: '', emojis: [] },
    media_attachments: [],
    emojis: [],
    favourited,
    reblogged: false,
});

const statusA = makeStatus('A', { replies: 11, boosts: 22, favs: 33 });
const statusB = makeStatus('B', { replies: 1, boosts: 2, favs: 3 });

// fireEvent resolves only when the press handler does. For requests kept pending on purpose, start the
// press and let its act() settle before doing anything else, so act() calls never overlap.
const startPress = async (element: Parameters<typeof fireEvent.press>[0]) => {
    const pressing = fireEvent.press(element);
    await new Promise(resolve => setImmediate(resolve));
    // Wrapped so awaiting startPress doesn't wait for the handler itself
    return { pressing };
};

const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

describe('TootCard recycling', () => {
    let queryClient: QueryClient;
    const wrap = (status: Status) => (
        <QueryClientProvider client={queryClient}>
            <MediaViewerProvider>
                <TootCard status={status} />
            </MediaViewerProvider>
        </QueryClientProvider>
    );

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(Alert, 'alert').mockImplementation(() => {});
        queryClient = createTestQueryClient();
    });

    it('does not carry favourite state over to a recycled status', async () => {
        mockedFavourite.mockResolvedValue({ ...statusA, favourited: true, favourites_count: 34 });
        const { rerender } = await render(wrap(statusA));

        await fireEvent.press(screen.getByText('33'));
        expect(screen.getByText('34')).toBeTruthy();

        // Same component instance now showing another status, as FlashList does when recycling
        await rerender(wrap(statusB));
        expect(screen.getByText('3')).toBeTruthy();
        expect(screen.queryByText('34')).toBeNull();
    });

    it('ignores a failed request that resolves after the card was recycled', async () => {
        const request = deferred<Status>();
        mockedFavourite.mockReturnValue(request.promise);
        const { rerender } = await render(wrap(statusA));

        const { pressing } = await startPress(screen.getByText('33'));
        await rerender(wrap(statusB));

        await act(async () => {
            request.reject(new Error('network'));
            await pressing;
        });
        expect(screen.getByText('3')).toBeTruthy();
        expect(screen.queryByText('33')).toBeNull();
    });

    it('writes the server result into cached timelines, including boosts', async () => {
        const boostOfA = { ...makeStatus('boost-1', { replies: 0, boosts: 0, favs: 0 }), reblog: statusA };
        queryClient.setQueryData(['timeline', 'home'], { pages: [[statusA, statusB]], pageParams: [undefined] });
        queryClient.setQueryData(['timeline', 'local'], { pages: [[boostOfA]], pageParams: [undefined] });
        mockedFavourite.mockResolvedValue({ ...statusA, favourited: true, favourites_count: 34 });
        await render(wrap(statusA));

        await fireEvent.press(screen.getByText('33'));

        const home = queryClient.getQueryData<{ pages: Status[][] }>(['timeline', 'home'])!;
        const local = queryClient.getQueryData<{ pages: Status[][] }>(['timeline', 'local'])!;
        expect(home.pages[0][0]).toMatchObject({ id: 'A', favourited: true, favourites_count: 34 });
        expect(home.pages[0][1]).toBe(statusB);
        expect(local.pages[0][0].reblog).toMatchObject({ id: 'A', favourited: true, favourites_count: 34 });
    });
});

describe('TootCard bookmarks', () => {
    let queryClient: QueryClient;
    const renderCard = (status: Status) =>
        render(
            <QueryClientProvider client={queryClient}>
                <MediaViewerProvider>
                    <TootCard status={status} />
                </MediaViewerProvider>
            </QueryClientProvider>
        );

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(Alert, 'alert').mockImplementation(() => {});
        queryClient = createTestQueryClient();
    });

    it('bookmarks a post and shows it as bookmarked', async () => {
        mockedBookmark.mockResolvedValue({ ...statusA, bookmarked: true });
        await renderCard(statusA);

        await fireEvent.press(screen.getByRole('button', { name: 'Bookmark' }));

        expect(mockedBookmark).toHaveBeenCalledWith('A');
        expect(screen.getByRole('button', { name: 'Bookmarked' })).toBeSelected();
    });

    it('removes a bookmark', async () => {
        mockedUnbookmark.mockResolvedValue({ ...statusA, bookmarked: false });
        await renderCard({ ...statusA, bookmarked: true });

        await fireEvent.press(screen.getByRole('button', { name: 'Bookmarked' }));

        expect(mockedUnbookmark).toHaveBeenCalledWith('A');
        expect(screen.getByRole('button', { name: 'Bookmark' })).not.toBeSelected();
    });

    it('rolls back and says so when bookmarking fails', async () => {
        mockedBookmark.mockRejectedValue(new Error('network'));
        await renderCard(statusA);

        await fireEvent.press(screen.getByRole('button', { name: 'Bookmark' }));

        expect(screen.getByRole('button', { name: 'Bookmark' })).not.toBeSelected();
        expect(Alert.alert).toHaveBeenCalled();
    });

    it('updates the post inside cached bookmark pages and refreshes the list', async () => {
        queryClient.setQueryData(['timeline', 'bookmarks'], { pages: [{ statuses: [statusA, statusB], nextMaxId: '9' }], pageParams: [undefined] });
        mockedBookmark.mockResolvedValue({ ...statusA, bookmarked: true });
        await renderCard(statusA);

        await fireEvent.press(screen.getByRole('button', { name: 'Bookmark' }));

        const bookmarks = queryClient.getQueryData<{ pages: { statuses: Status[]; nextMaxId?: string }[] }>(['timeline', 'bookmarks'])!;
        expect(bookmarks.pages[0].statuses[0]).toMatchObject({ id: 'A', bookmarked: true });
        expect(bookmarks.pages[0].nextMaxId).toBe('9');
        expect(queryClient.getQueryState(['timeline', 'bookmarks'])?.isInvalidated).toBe(true);
    });
});

describe('Poll recycling', () => {
    const makePoll = (id: string, voted: boolean): PollType => ({
        id,
        expires_at: null,
        expired: false,
        multiple: false,
        votes_count: 10,
        voters_count: 10,
        voted,
        own_votes: voted ? [0] : [],
        options: [
            { title: `${id} yes`, votes_count: 7 },
            { title: `${id} no`, votes_count: 3 },
        ],
        emojis: [],
    });

    beforeEach(() => jest.clearAllMocks());

    it('shows the new poll after recycling instead of the previous results', async () => {
        const { rerender } = await render(<Poll initialPoll={makePoll('p1', true)} />);
        expect(screen.getByText('70%')).toBeTruthy();

        await rerender(<Poll initialPoll={makePoll('p2', false)} />);
        expect(screen.queryByText('70%')).toBeNull();
        expect(screen.getByText('Vote')).toBeTruthy();
    });

    it('reports the vote result and ignores it once recycled', async () => {
        const request = deferred<PollType>();
        mockedVote.mockReturnValue(request.promise);
        const onPollUpdated = jest.fn();
        const { rerender } = await render(<Poll initialPoll={makePoll('p1', false)} onPollUpdated={onPollUpdated} />);

        await fireEvent.press(screen.getByText('p1 yes'));
        const { pressing: voting } = await startPress(screen.getByText('Vote'));
        await rerender(<Poll initialPoll={makePoll('p2', false)} onPollUpdated={onPollUpdated} />);

        const votedP1 = makePoll('p1', true);
        await act(async () => {
            request.resolve(votedP1);
            await voting;
        });
        expect(onPollUpdated).toHaveBeenCalledWith(votedP1);
        expect(screen.getByText('p2 yes')).toBeTruthy();
        expect(screen.queryByText('70%')).toBeNull();
    });
});

describe('TootCard content', () => {
    const renderCard = (status: Status) =>
        render(
            <QueryClientProvider client={createTestQueryClient()}>
                <MediaViewerProvider>
                    <TootCard status={status} />
                </MediaViewerProvider>
            </QueryClientProvider>
        );

    const withMedia = (status: Status): Status => ({
        ...status,
        media_attachments: [{ id: 'm1', type: 'image', url: 'https://example.social/m1.png', preview_url: 'https://example.social/m1-small.png' }],
    });

    it('shows sensitive posts without a CW, veiling only the media', async () => {
        await renderCard(withMedia({ ...statusA, sensitive: true, spoiler_text: '' }));

        expect(screen.getByText(/status A/)).toBeTruthy();
        expect(screen.getByText('Sensitive · 1 photo')).toBeTruthy();
        // The veiled image is hidden from screen readers until it's shown
        expect(screen.queryByRole('imagebutton')).toBeNull();
    });

    it('shows sensitive media on request and can hide it again', async () => {
        await renderCard(withMedia({ ...statusA, sensitive: true }));

        await fireEvent.press(screen.getByRole('button', { name: 'Show' }));
        expect(screen.queryByText('Sensitive · 1 photo')).toBeNull();
        expect(screen.getByRole('imagebutton', { name: 'Image 1 of 1' })).toBeTruthy();

        await fireEvent.press(screen.getByRole('button', { name: 'Hide media' }));
        expect(screen.getByText('Sensitive · 1 photo')).toBeTruthy();
    });

    it('collapses posts with a CW into a ribbon that says what is hidden', async () => {
        await renderCard(withMedia({ ...statusA, sensitive: true, spoiler_text: 'Spoilers' }));

        expect(screen.getByText('Content warning')).toBeTruthy();
        expect(screen.getByText('Spoilers')).toBeTruthy();
        expect(screen.getByText('Text and 1 photo hidden')).toBeTruthy();
        expect(screen.queryByText(/status A/)).toBeNull();

        await fireEvent.press(screen.getByRole('button', { name: 'Show' }));
        expect(screen.getByText('CW · Spoilers')).toBeTruthy();
        expect(screen.getByText(/status A/)).toBeTruthy();

        await fireEvent.press(screen.getByRole('button', { name: 'Hide' }));
        expect(screen.queryByText(/status A/)).toBeNull();
        expect(screen.getByText('Text and 1 photo hidden')).toBeTruthy();
    });

    it('treats a CW as collapsible even when the post is not marked sensitive', async () => {
        await renderCard({ ...statusA, sensitive: false, spoiler_text: 'Politics' });

        expect(screen.getByText('Politics')).toBeTruthy();
        expect(screen.getByText('Text hidden')).toBeTruthy();
        expect(screen.queryByText(/status A/)).toBeNull();
    });

    it('shows non-sensitive media without the veil', async () => {
        await renderCard(withMedia(statusA));

        expect(screen.queryByText(/Sensitive ·/)).toBeNull();
        expect(screen.getByRole('imagebutton', { name: 'Image 1 of 1' })).toBeTruthy();
    });

    it('shows a link preview with its provider and title', async () => {
        await renderCard({
            ...statusA,
            card: { url: 'https://www.tidepool.studio/post', title: 'Leaving the algorithm', description: '8 min read', type: 'link', image: 'https://tidepool.studio/cover.png', provider_name: '' },
        } as Status);

        expect(screen.getByRole('link', { name: 'Leaving the algorithm' })).toBeTruthy();
        expect(screen.getByText('tidepool.studio')).toBeTruthy();
        expect(screen.getByText('8 min read')).toBeTruthy();
    });

    it('shows the boost and favourite state on the action buttons', async () => {
        await renderCard({ ...statusA, favourited: true, reblogged: false });

        expect(screen.getByRole('button', { name: 'Favourited, 33 favourites' })).toBeSelected();
        expect(screen.getByRole('button', { name: 'Boost, 22 boosts' })).not.toBeSelected();
        expect(screen.getByRole('button', { name: 'Reply, 11 replies' })).toBeTruthy();
    });

    it('hides the numbers under the post when asked, keeping them for screen readers', async () => {
        mockSettings.hideCounts = true;
        try {
            await renderCard(statusA);

            for (const count of ['11', '22', '33']) expect(screen.queryByText(count)).toBeNull();
            expect(screen.getByRole('button', { name: 'Favourite, 33 favourites' })).toBeTruthy();
            expect(screen.getByRole('button', { name: 'Reply, 11 replies' })).toBeTruthy();
        } finally {
            mockSettings.hideCounts = false;
        }
    });
});

describe('TootCard in Compact Mode', () => {
    beforeEach(() => {
        mockSettings.compactMode = true;
    });
    afterEach(() => {
        mockSettings.compactMode = false;
    });

    const renderCard = (status: Status) =>
        render(
            <QueryClientProvider client={createTestQueryClient()}>
                <MediaViewerProvider>
                    <TootCard status={status} />
                </MediaViewerProvider>
            </QueryClientProvider>
        );

    it('shows link previews as a title + domain row without the thumbnail', async () => {
        await renderCard({
            ...statusA,
            card: { url: 'https://www.tidepool.studio/post', title: 'Leaving the algorithm', description: '8 min read', type: 'link', image: 'https://tidepool.studio/cover.png', provider_name: '' },
        } as Status);

        const link = screen.getByRole('link', { name: 'Leaving the algorithm' });
        expect(link).toBeTruthy();
        expect(screen.getByText('tidepool.studio')).toBeTruthy();
        expect(screen.queryByText('8 min read')).toBeNull();
        // No cover image inside the preview
        expect(screen.toJSON() && JSON.stringify(screen.toJSON())).not.toContain('tidepool.studio/cover.png');
    });

    it('caps a single image at 140 high', async () => {
        await renderCard({
            ...statusA,
            media_attachments: [{ id: 'm1', type: 'image', url: 'https://example.social/m1.png', preview_url: 'https://example.social/m1-small.png' }],
        } as Status);

        expect(StyleSheet.flatten(screen.getByRole('imagebutton', { name: 'Image 1 of 1' }).props.style).height).toBe(140);
    });

    it('slims the action buttons but keeps a full-size touch area', async () => {
        await renderCard(statusA);

        const reply = screen.getByRole('button', { name: 'Reply, 11 replies' });
        expect(StyleSheet.flatten(reply.props.style).minHeight).toBe(COMPACT_ACTION_HEIGHT);
        const slop = reply.props.hitSlop;
        expect(COMPACT_ACTION_HEIGHT + slop.top + slop.bottom).toBeGreaterThanOrEqual(MIN_TOUCH);
    });
});

describe('TootCard opens profiles', () => {
    // Shows the routes pushed so far
    const StackProbe = () => {
        const { stack } = useNavigator();
        const { Text: MockText } = jest.requireActual('react-native');
        return <MockText testID="stack">{JSON.stringify(stack.map(entry => entry.route))}</MockText>;
    };
    const renderInStack = (status: Status) =>
        render(
            <QueryClientProvider client={createTestQueryClient()}>
                <NavigationProvider>
                    <MediaViewerProvider>
                        <TootCard status={status} />
                        <StackProbe />
                    </MediaViewerProvider>
                </NavigationProvider>
            </QueryClientProvider>
        );
    const pushed = () => JSON.parse(screen.getByTestId('stack').props.children);

    it("opens the author's profile from the name and the avatar", async () => {
        await renderInStack(statusA);
        const author = statusA.account.display_name || statusA.account.username;

        const links = screen.getAllByRole('link', { name: `${author}'s profile` });
        expect(links).toHaveLength(2);
        await fireEvent.press(links[0]);

        expect(pushed()).toEqual([{ name: 'account', accountId: statusA.account.id, account: statusA.account }]);
    });

    it('opens the booster from the boost line', async () => {
        const booster = { ...statusB.account, id: 'booster', username: 'booster', display_name: 'Booster' };
        await renderInStack({ ...makeStatus('boost', { replies: 0, boosts: 0, favs: 0 }), account: booster, reblog: statusA } as Status);

        await fireEvent.press(screen.getByText('Booster boosted'));

        expect(pushed()[0]).toMatchObject({ name: 'account', accountId: 'booster' });
    });
});

describe('describeHidden', () => {
    const media = (type: Attachment['type'], id: string): Attachment => ({ id, type, url: '', preview_url: '' });

    it('lists what a content warning hides', () => {
        expect(describeHidden({ ...statusA, media_attachments: [] })).toBe('Text hidden');
        expect(describeHidden({ ...statusA, media_attachments: [media('image', '1'), media('image', '2')] })).toBe('Text and 2 photos hidden');
        expect(describeHidden({
            ...statusA,
            poll: { id: 'p' } as PollType,
            media_attachments: [media('video', '1')],
            card: { url: 'https://x.y' } as Status['card'],
        })).toBe('Text, a poll, 1 video and a link hidden');
        expect(describeHidden({ ...statusA, content: '<p></p>', media_attachments: [media('image', '1'), media('video', '2')] })).toBe('2 attachments hidden');
    });
});

describe('TootCard share', () => {
    const renderCard = (status: Status) =>
        render(
            <QueryClientProvider client={createTestQueryClient()}>
                <MediaViewerProvider>
                    <TootCard status={status} />
                </MediaViewerProvider>
            </QueryClientProvider>
        );

    const expectedShare = (link: string) => (Platform.OS === 'ios' ? { url: link } : { message: link });

    beforeEach(() => {
        jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
    });

    afterEach(() => jest.restoreAllMocks());

    it('shares the post URL', async () => {
        await renderCard(statusA);

        await fireEvent.press(screen.getByLabelText('Share'));
        expect(Share.share).toHaveBeenCalledWith(expectedShare(statusA.url!));
    });

    it('shares the original post, not the boost', async () => {
        const boost = { ...makeStatus('boost-1', { replies: 0, boosts: 0, favs: 0 }), reblog: statusA };
        await renderCard(boost);

        await fireEvent.press(screen.getByLabelText('Share'));
        expect(Share.share).toHaveBeenCalledWith(expectedShare(statusA.url!));
    });

    it('falls back to the URI when the status has no URL', async () => {
        await renderCard({ ...statusA, url: null });

        await fireEvent.press(screen.getByLabelText('Share'));
        expect(Share.share).toHaveBeenCalledWith(expectedShare(statusA.uri));
    });
});

describe('TootCard press', () => {
    const renderCard = (status: Status, onPress: (id: string) => void) =>
        render(
            <QueryClientProvider client={createTestQueryClient()}>
                <MediaViewerProvider>
                    <TootCard status={status} onPress={onPress} />
                </MediaViewerProvider>
            </QueryClientProvider>
        );

    it('opens the status itself', async () => {
        const onPress = jest.fn();
        await renderCard(statusA, onPress);

        await fireEvent.press(screen.getByText(/status A/));
        expect(onPress).toHaveBeenCalledWith('A');
    });

    it('opens the original status for a boost, not the boost wrapper', async () => {
        const onPress = jest.fn();
        await renderCard({ ...makeStatus('boost-1', { replies: 0, boosts: 0, favs: 0 }), reblog: statusA }, onPress);

        await fireEvent.press(screen.getByText(/status A/));
        expect(onPress).toHaveBeenCalledWith('A');
    });
});
