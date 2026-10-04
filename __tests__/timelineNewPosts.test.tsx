import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils/queryClient';
import { fetchHomeTimeline, fetchPublicTimeline } from '../services/mastodon/timeline';
import { NewPosts } from '../hooks/useNewPosts';
import Timeline from '../screens/Timeline/timeline';
import { Account, Status } from '../services/mastodon/types';

// Pinned feeds are kept per account
jest.mock('../services/mastodon/tags', () => ({ ...jest.requireActual('../services/mastodon/tags'), getFollowedTags: jest.fn(async () => []) }));
jest.mock('../services/authContext', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));
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
jest.mock('../hooks/useNewPosts', () => ({
    ...jest.requireActual('../hooks/useNewPosts'),
    useNewPosts: () => mockNewPosts,
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

    it('reloads only the first page when tapped', async () => {
        mockNewPosts = { count: 1, more: false, accounts: [] };
        await renderTimeline();
        await screen.findByText('post 10');
        // Pretend a second page was loaded
        queryClient.setQueryData(['timeline', 'home'], (data: any) => ({
            pages: [...data.pages, [post('8')]],
            pageParams: [...data.pageParams, '9'],
        }));
        mockedHome.mockResolvedValue([post('12'), post('11'), post('10')]);

        await fireEvent.press(screen.getByRole('button', { name: '1 new post' }));

        await waitFor(() => expect(screen.getByText('post 12')).toBeTruthy());
        const data = queryClient.getQueryData<{ pages: Status[][] }>(['timeline', 'home'])!;
        expect(data.pages).toHaveLength(1);
        expect(mockedHome).toHaveBeenLastCalledWith(undefined);
        // The pill stops loading once the list has scrolled up
        await waitFor(() => expect(screen.getByRole('button', { name: '1 new post' })).not.toBeBusy());
    });
});
