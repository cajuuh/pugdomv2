import { DeviceEventEmitter, ScrollView } from 'react-native';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils/queryClient';
import { fetchHomeTimeline, fetchPublicTimeline } from '../services/mastodon/timeline';
import { fetchFeedRange } from '../services/mastodon/feedService';
import { NewPosts } from '../hooks/useNewPosts';
import Timeline from '../screens/Timeline/timeline';
import { Account, Status } from '../services/mastodon/types';

// Pinned feeds are kept per account
jest.mock('../services/settingsContext', () => ({ useOptionalSettings: () => null, useSettings: () => ({ swipeFeeds: false, homeBoosts: true, homeReplies: true }) }));
jest.mock('../services/mastodon/tags', () => ({ ...jest.requireActual('../services/mastodon/tags'), getFollowedTags: jest.fn(async () => []) }));
jest.mock('../services/authContext', () => ({ useAuth: () => ({ user: { id: 'me' } }), useOptionalAuth: () => ({ user: { id: 'me' } }) }));
jest.mock('../services/themeContext', () => ({
    useTheme: () => jest.requireActual('../testUtils/theme').mockTheme,
}));
jest.mock('../components/TootCard/tootCard', () => ({
    TootCard: ({ status }: { status: Status }) => {
        const { Text: MockText } = jest.requireActual('react-native');
        return <MockText>{status.content}</MockText>;
    },
}));

const account = (id: string): Account => ({ id, username: `user${id}`, acct: `user${id}`, display_name: `User ${id}`, avatar: '', emojis: [] });
const post = (id: string, accountId = id) => ({ id, content: `post ${id}`, account: account(accountId) } as Status);

let mockNewPosts: NewPosts = { count: 0, more: false, accounts: [] };
jest.mock('../components/ui', () => {
    const { Text: MockText } = jest.requireActual('react-native');
    return {
        ...jest.requireActual('../components/ui'),
        Avatar: ({ uri }: { uri?: string }) => <MockText testID="avatar">{uri}</MockText>,
    };
});
jest.mock('../hooks/useNewPosts', () => ({
    ...jest.requireActual('../hooks/useNewPosts'),
    useNewPosts: () => mockNewPosts,
}));
jest.mock('../services/mastodon/markers', () => ({ getHomeMarker: jest.fn(async () => null), saveHomeMarker: jest.fn() }));
jest.mock('../services/mastodon/feedService', () => ({
    ...jest.requireActual('../services/mastodon/feedService'),
    fetchFeedRange: jest.fn(async () => []),
}));
jest.mock('../services/mastodon/timeline', () => ({
    ...jest.requireActual('../services/mastodon/timeline'),
    fetchHomeTimeline: jest.fn(),
    fetchPublicTimeline: jest.fn(),
}));

describe('Timeline new posts pill', () => {
    let queryClient: QueryClient;
    const mockedHome = fetchHomeTimeline as jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        queryClient = createTestQueryClient();
        mockedHome.mockResolvedValue([post('10'), post('9')]);
        (fetchPublicTimeline as jest.Mock).mockResolvedValue([]);
    });

    const renderTimeline = () =>
        render(
            <QueryClientProvider client={queryClient}>
                <Timeline />
            </QueryClientProvider>
        );

    it('stays hidden when nothing is new', async () => {
        mockNewPosts = { count: 0, more: false, accounts: [] };
        await renderTimeline();
        await screen.findByText('post 10');

        expect(screen.queryByRole('button', { name: /new post/ })).toBeNull();
    });

    it('shows how many posts are new, with "+" for a full page', async () => {
        mockNewPosts = { count: 3, more: false, accounts: [account('a')] };
        const { rerender } = await renderTimeline();
        expect(await screen.findByRole('button', { name: '3 new posts' })).toBeTruthy();

        mockNewPosts = { count: 40, more: true, accounts: [] };
        await rerender(
            <QueryClientProvider client={queryClient}>
                <Timeline />
            </QueryClientProvider>
        );
        expect(screen.getByRole('button', { name: '40+ new posts' })).toBeTruthy();
    });

    describe('collapsing', () => {
        const drag = () => fireEvent(screen.getByText('post 10'), 'scrollBeginDrag');
        const rerenderWith = async (rerender: (ui: React.ReactElement) => unknown, newPosts: NewPosts) => {
            mockNewPosts = newPosts;
            await rerender(
                <QueryClientProvider client={queryClient}>
                    <Timeline />
                </QueryClientProvider>
            );
        };

        it('shrinks to the arrow and the count once you scroll, still telling screen readers it all', async () => {
            mockNewPosts = { count: 3, more: false, accounts: [account('a')] };
            await renderTimeline();
            await screen.findByText('post 10');
            await screen.findByText('3 new posts');
            expect(screen.getAllByTestId('avatar')).toHaveLength(1);

            await drag();

            expect(screen.getByText('3')).toBeTruthy();
            expect(screen.queryByText('3 new posts')).toBeNull();
            expect(screen.queryAllByTestId('avatar')).toHaveLength(0);
            expect(screen.getByRole('button', { name: '3 new posts' })).toBeTruthy();
        });

        it('keeps the "+" for a full page', async () => {
            mockNewPosts = { count: 40, more: true, accounts: [] };
            await renderTimeline();
            await screen.findByText('post 10');
            await screen.findByText('40+ new posts');

            await drag();

            expect(screen.getByText('40+')).toBeTruthy();
        });

        it('opens again for the next new posts', async () => {
            mockNewPosts = { count: 3, more: false, accounts: [] };
            const { rerender } = await renderTimeline();
            await screen.findByText('post 10');
            await screen.findByText('3 new posts');
            await drag();

            await rerenderWith(rerender, { count: 0, more: false, accounts: [] });
            await rerenderWith(rerender, { count: 2, more: false, accounts: [] });

            expect(screen.getByText('2 new posts')).toBeTruthy();
        });

        it('starts open when you scrolled before it appeared', async () => {
            mockNewPosts = { count: 0, more: false, accounts: [] };
            const { rerender } = await renderTimeline();
            await screen.findByText('post 10');
            await drag();

            await rerenderWith(rerender, { count: 3, more: false, accounts: [] });

            expect(screen.getByText('3 new posts')).toBeTruthy();
        });

        it('shows the still picture of an animated avatar', async () => {
            mockNewPosts = { count: 1, more: false, accounts: [{ ...account('a'), avatar: 'moving.gif', avatar_static: 'still.png' }] };
            await renderTimeline();
            await screen.findByText('1 new post');

            expect(screen.getByTestId('avatar')).toHaveTextContent('still.png');
        });
    });

    it("doesn't let focus move the list: a post's text keeps it after a tap, and the list would jump there", async () => {
        mockNewPosts = { count: 0, more: false, accounts: [] };
        await renderTimeline();
        let node: any = await screen.findByText('post 10');
        while (node && node.props.scrollsChildToFocus === undefined) node = node.parent;

        expect(node?.props.scrollsChildToFocus).toBe(false);
    });

    it('puts the new posts on top when tapped, keeping the ones loaded', async () => {
        mockNewPosts = { count: 2, more: false, accounts: [] };
        await renderTimeline();
        await screen.findByText('post 10');
        // Pretend a second page was loaded
        queryClient.setQueryData(['timeline', 'home'], (data: any) => ({
            pages: [...data.pages, [post('8')]],
            pageParams: [...data.pageParams, '9'],
        }));
        (fetchFeedRange as jest.Mock).mockResolvedValue([post('12'), post('11')]);

        await fireEvent.press(screen.getByRole('button', { name: '2 new posts' }));

        await waitFor(() => expect(screen.getByText('post 12')).toBeTruthy());
        expect(fetchFeedRange).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'home' }), { since_id: '10', limit: 40 });
        const data = queryClient.getQueryData<{ pages: Status[][] }>(['timeline', 'home'])!;
        expect(data.pages.flat().map(p => p.id)).toEqual(['12', '11', '10', '9', '8']);
        expect(screen.queryByTestId('timeline-gap')).toBeNull();
        expect(mockedHome).toHaveBeenCalledTimes(1);
        // The pill stops loading once the list has scrolled up
        await waitFor(() => expect(screen.getByRole('button', { name: '2 new posts' })).not.toBeBusy());
    });

    it("leaves a gap under a full page of new posts, and fills it from either end", async () => {
        mockNewPosts = { count: 40, more: true, accounts: [] };
        await renderTimeline();
        await screen.findByText('post 10');
        const page = Array.from({ length: 40 }, (_, i) => post(String(100 - i)));
        (fetchFeedRange as jest.Mock).mockResolvedValueOnce(page);

        await fireEvent.press(screen.getByRole('button', { name: '40+ new posts' }));
        await waitFor(() => expect(screen.getByTestId('timeline-gap')).toBeTruthy());

        // From under it: the posts just above "post 10". Less than a page closes it.
        (fetchFeedRange as jest.Mock).mockResolvedValueOnce([post('30'), post('20')]);
        await fireEvent.press(screen.getByRole('button', { name: 'Load newer' }));
        expect(fetchFeedRange).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'home' }), { min_id: '10', max_id: '61', limit: 40 });
        await waitFor(() => expect(screen.queryByTestId('timeline-gap')).toBeNull());
        const ids = queryClient.getQueryData<{ pages: Status[][] }>(['timeline', 'home'])!.pages.flat().map(p => p.id);
        expect(ids.slice(38)).toEqual(['62', '61', '30', '20', '10', '9']);
    });

    it('loads the newest posts and goes to the top when Home is tapped on Home', async () => {
        mockNewPosts = { count: 0, more: false, accounts: [] };
        const scrollTo = jest.spyOn(ScrollView.prototype as any, 'scrollTo');
        await renderTimeline();
        await screen.findByText('post 10');
        (fetchFeedRange as jest.Mock).mockResolvedValue([post('11')]);
        scrollTo.mockClear();

        await act(async () => {
            DeviceEventEmitter.emit('scroll_to_top_home');
        });

        await waitFor(() => expect(screen.getByText('post 11')).toBeTruthy());
        await waitFor(() => expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ y: 0 })));
        scrollTo.mockRestore();
    });

    it('goes back to the top when the feed you are on is tapped again, and switches on another', async () => {
        mockNewPosts = { count: 0, more: false, accounts: [] };
        const scrollTo = jest.spyOn(ScrollView.prototype as any, 'scrollTo');
        await renderTimeline();
        await screen.findByText('post 10');
        scrollTo.mockClear();

        await act(async () => fireEvent.press(screen.getByRole('tab', { name: 'Home' })));
        await waitFor(() => expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ y: 0 })));
        expect(fetchPublicTimeline).not.toHaveBeenCalled();

        await fireEvent.press(screen.getByRole('tab', { name: 'Local' }));
        await waitFor(() => expect(fetchPublicTimeline).toHaveBeenCalled());
        scrollTo.mockRestore();
    });

    it('keeps a feed in place behind the others, without reloading it', async () => {
        mockNewPosts = { count: 0, more: false, accounts: [] };
        (fetchPublicTimeline as jest.Mock).mockResolvedValue([post('local')]);
        await renderTimeline();
        const homeRow = await screen.findByText('post 10');

        await fireEvent.press(screen.getByRole('tab', { name: 'Local' }));
        await screen.findByText('post local');
        expect(screen.queryByText('post 10')).toBeNull();
        // Hidden, but the same row: unmounting it is what lost the place
        expect(screen.getByText('post 10', { includeHiddenElements: true })).toBe(homeRow);

        await fireEvent.press(screen.getByRole('tab', { name: 'Home' }));
        expect(screen.getByText('post 10')).toBe(homeRow);
        expect(screen.queryByText('post local')).toBeNull();
        expect(mockedHome).toHaveBeenCalledTimes(1);
    });

    it('opens a feed from its own top, not where the last one was', async () => {
        mockNewPosts = { count: 0, more: false, accounts: [] };
        (fetchPublicTimeline as jest.Mock).mockResolvedValue([post('local')]);
        await renderTimeline();
        const homeRow = await screen.findByText('post 10');

        await fireEvent.press(screen.getByRole('tab', { name: 'Local' }));
        const localRow = await screen.findByText('post local');

        expect(localRow).not.toBe(homeRow);
        expect(screen.getAllByText(/^post /, { includeHiddenElements: true })).toHaveLength(3);
    });

    it('sends Home in the dock only to the feed on screen', async () => {
        mockNewPosts = { count: 0, more: false, accounts: [] };
        (fetchPublicTimeline as jest.Mock).mockResolvedValue([post('local')]);
        await renderTimeline();
        await screen.findByText('post 10');
        await fireEvent.press(screen.getByRole('tab', { name: 'Local' }));
        await screen.findByText('post local');
        (fetchFeedRange as jest.Mock).mockClear();

        await act(async () => {
            DeviceEventEmitter.emit('scroll_to_top_home');
        });

        await waitFor(() => expect(fetchFeedRange).toHaveBeenCalledWith(expect.objectContaining({ kind: 'local' }), { since_id: 'local', limit: 40 }));
        expect(fetchFeedRange).toHaveBeenCalledTimes(1);
    });
});
