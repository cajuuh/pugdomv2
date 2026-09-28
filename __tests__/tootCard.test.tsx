import React from 'react';
import { Alert, Platform, Share } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils/queryClient';
import { TootCard } from '../components/TootCard/tootCard';
import { Poll } from '../components/Poll/poll';
import { favouriteStatus } from '../services/mastodon/statuses';
import { votePoll } from '../services/mastodon/polls';
import { Poll as PollType, Status } from '../services/mastodon/types';

jest.mock('../services/mastodon/statuses', () => ({
    favouriteStatus: jest.fn(),
    unfavouriteStatus: jest.fn(),
    reblogStatus: jest.fn(),
    unreblogStatus: jest.fn(),
}));

jest.mock('../services/mastodon/polls', () => ({
    votePoll: jest.fn(),
}));

jest.mock('../services/settingsContext', () => ({
    useSettings: () => ({ compactMode: false, mediaAutoplay: false }),
}));

jest.mock('../services/themeContext', () => ({
    useTheme: () => ({ colors: jest.requireActual('../services/themeContext').lightColors, isDark: false }),
}));

jest.mock('../services/composeContext', () => ({
    useCompose: () => ({ openCompose: jest.fn() }),
}));

const mockedFavourite = favouriteStatus as jest.MockedFunction<typeof favouriteStatus>;
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
            <TootCard status={status} />
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
                <TootCard status={status} />
            </QueryClientProvider>
        );

    const withMedia = (status: Status): Status => ({
        ...status,
        media_attachments: [{ id: 'm1', type: 'image', url: 'https://example.social/m1.png', preview_url: 'https://example.social/m1-small.png' }],
    });

    it('shows sensitive posts without a CW, blurring only the media', async () => {
        await renderCard(withMedia({ ...statusA, sensitive: true, spoiler_text: '' }));

        expect(screen.getByText(/status A/)).toBeTruthy();
        expect(screen.queryByText('Show')).toBeNull();
        expect(screen.getByText('Sensitive Content (Tap to show)')).toBeTruthy();
    });

    it('collapses posts with a CW until Show is pressed', async () => {
        await renderCard({ ...statusA, sensitive: true, spoiler_text: 'Spoilers' });

        expect(screen.getByText('CW: Spoilers')).toBeTruthy();
        expect(screen.queryByText(/status A/)).toBeNull();

        await fireEvent.press(screen.getByText('Show'));
        expect(screen.getByText(/status A/)).toBeTruthy();
        expect(screen.getByText('Hide')).toBeTruthy();
    });

    it('treats a CW as collapsible even when the post is not marked sensitive', async () => {
        await renderCard({ ...statusA, sensitive: false, spoiler_text: 'Politics' });

        expect(screen.getByText('CW: Politics')).toBeTruthy();
        expect(screen.queryByText(/status A/)).toBeNull();
    });

    it('shows non-sensitive media without the blur', async () => {
        await renderCard(withMedia(statusA));

        expect(screen.queryByText('Sensitive Content (Tap to show)')).toBeNull();
    });
});

describe('TootCard share', () => {
    const renderCard = (status: Status) =>
        render(
            <QueryClientProvider client={createTestQueryClient()}>
                <TootCard status={status} />
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
                <TootCard status={status} onPress={onPress} />
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
