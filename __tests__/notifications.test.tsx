import React from 'react';
import { View } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils/queryClient';
import Notifications from '../screens/Notifications/notifications';
import { fetchNotifications } from '../services/mastodon/notifications';
import { followAccount, getRelationships } from '../services/mastodon/accounts';
import { Account, Notification } from '../services/mastodon/types';

jest.mock('../services/mastodon/notifications', () => ({ fetchNotifications: jest.fn() }));
jest.mock('../services/mastodon/accounts', () => ({ followAccount: jest.fn(), getRelationships: jest.fn() }));
jest.mock('../services/themeContext', () => ({
    useTheme: () => jest.requireActual('../testUtils/theme').mockTheme,
}));

const mockedFetch = fetchNotifications as jest.MockedFunction<typeof fetchNotifications>;
const mockedFollow = followAccount as jest.MockedFunction<typeof followAccount>;
const mockedRelationships = getRelationships as jest.MockedFunction<typeof getRelationships>;

const account = (id: string, name: string, extra: Partial<Account> = {}): Account =>
    ({ id, username: name, acct: name, display_name: name, avatar: '', emojis: [], ...extra });

const notification = (id: string, type: Notification['type'], from: Account): Notification => ({
    id,
    type,
    created_at: new Date().toISOString(),
    account: from,
    status: type === 'follow' ? undefined : ({ id: `s-${id}`, content: `<p>post ${id}</p>` } as any),
});

const relationship = (id: string, following: boolean) => ({ id, following, requested: false, followed_by: true });

describe('Notifications', () => {
    let queryClient: QueryClient;

    const renderScreen = () =>
        render(
            <QueryClientProvider client={queryClient}>
                <Notifications />
            </QueryClientProvider>
        );

    beforeEach(() => {
        jest.clearAllMocks();
        queryClient = createTestQueryClient();
        mockedRelationships.mockResolvedValue([]);
    });

    it('asks the server only for the types it can render', async () => {
        mockedFetch.mockResolvedValue([notification('1', 'mention', account('a', 'alice'))]);
        await renderScreen();

        await screen.findByText(/mentioned you/);
        expect(mockedFetch).toHaveBeenCalledWith(undefined, ['mention', 'reblog', 'favourite', 'follow']);
    });

    it.each([
        ['Mentions', ['mention']],
        ['Follows', ['follow']],
    ] as const)('filters %s on the server from the switcher', async (tab, types) => {
        mockedFetch.mockResolvedValue([]);
        await renderScreen();
        await screen.findByText('No notifications yet!');

        await fireEvent.press(screen.getByRole('tab', { name: tab }));

        await waitFor(() => expect(mockedFetch).toHaveBeenCalledWith(undefined, types));
        expect(screen.getByRole('tab', { name: tab })).toBeSelected();
        expect(screen.getByRole('tab', { name: 'All' })).not.toBeSelected();
    });

    it('skips notification types it cannot render', async () => {
        mockedFetch.mockResolvedValue([
            notification('1', 'poll', account('a', 'alice')),
            notification('2', 'favourite', account('b', 'bob')),
        ]);
        await renderScreen();

        expect(await screen.findByText(/favourited your status/)).toBeTruthy();
        expect(screen.getAllByText(/your status|mentioned you|followed you/)).toHaveLength(1);
    });

    it('keeps notifications cached when coming back to the tab', async () => {
        mockedFetch.mockResolvedValue([notification('1', 'mention', account('a', 'alice'))]);
        const { rerender } = await renderScreen();
        await screen.findByText(/mentioned you/);

        // The refetch on return never resolves, so the list can only come from the cache
        mockedFetch.mockReturnValue(new Promise(() => {}));

        // Leave the tab (the screen unmounts) and come back, within the same render root
        await rerender(<QueryClientProvider client={queryClient}><View /></QueryClientProvider>);
        expect(screen.queryByText(/mentioned you/)).toBeNull();
        await rerender(<QueryClientProvider client={queryClient}><Notifications /></QueryClientProvider>);

        // Rendered from cache straight away, no loading state
        expect(screen.getByText(/mentioned you/)).toBeTruthy();
    });

    it('renders custom emoji in display names', async () => {
        const emojiAccount = account('a', 'alice', {
            display_name: 'Alice :blobcat:',
            emojis: [{ shortcode: 'blobcat', url: 'https://x/blobcat.png', static_url: '', visible_in_picker: true }],
        });
        mockedFetch.mockResolvedValue([notification('1', 'mention', emojiAccount)]);
        await renderScreen();

        await screen.findByText(/mentioned you/);
        expect(screen.queryByText(/:blobcat:/)).toBeNull();
    });

    it('follows back and then shows the new state', async () => {
        mockedFetch.mockResolvedValue([notification('1', 'follow', account('b', 'bob'))]);
        mockedRelationships.mockResolvedValue([relationship('b', false)]);
        mockedFollow.mockResolvedValue(relationship('b', true));
        await renderScreen();

        await fireEvent.press(await screen.findByText('Follow back'));

        expect(mockedFollow).toHaveBeenCalledWith('b');
        expect(await screen.findByText('Following')).toBeTruthy();
        expect(screen.queryByText('Follow back')).toBeNull();
    });

    it('does not offer to follow accounts already followed', async () => {
        mockedFetch.mockResolvedValue([notification('1', 'follow', account('b', 'bob'))]);
        mockedRelationships.mockResolvedValue([relationship('b', true)]);
        await renderScreen();

        expect(await screen.findByText('Following')).toBeTruthy();
        expect(screen.queryByText('Follow back')).toBeNull();
        expect(mockedRelationships).toHaveBeenCalledWith(['b']);
    });
});
