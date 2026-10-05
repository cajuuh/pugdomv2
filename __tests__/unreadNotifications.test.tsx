import React from 'react';
import { Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils/queryClient';
import apiClient from '../services/api/client';
import { getNewestNotificationId } from '../services/mastodon/notifications';
import { getNotificationsMarker } from '../services/mastodon/markers';
import { hasUnread, useMarkNotificationsSeen, useUnreadNotifications } from '../hooks/useUnreadNotifications';
import { TabBar } from '../components/TabBar/tabBar';

jest.mock('../services/api/client', () => ({
    __esModule: true,
    default: { get: jest.fn(), post: jest.fn() },
}));
jest.mock('../services/storage', () => ({
    getCredentials: async () => ({ accessToken: 'token', instanceUrl: 'https://home.social' }),
}));
jest.mock('../services/authContext', () => ({ useOptionalAuth: () => ({ user: { id: 'me' } }) }));
jest.mock('../services/themeContext', () => ({
    useTheme: () => jest.requireActual('../testUtils/theme').mockTheme,
}));

const api = apiClient as unknown as Record<'get', jest.Mock>;
// The server's newest notification and read marker
const serve = (newest: string | null, marker: string | null) =>
    api.get.mockImplementation(async (url: string) =>
        url === '/markers'
            ? { data: marker ? { notifications: { last_read_id: marker } } : {} }
            : { data: newest ? [{ id: newest }] : [] }
    );

beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
});

describe('unread notifications', () => {
    it('counts as unread only past both the read marker and what this device saw', () => {
        expect(hasUnread('200', '100', null)).toBe(true);
        expect(hasUnread('200', null, null)).toBe(true);
        expect(hasUnread('200', '200', null)).toBe(false);
        expect(hasUnread('200', '100', '200')).toBe(false);
        // Snowflake ids grow in length
        expect(hasUnread('1000', '999', null)).toBe(true);
        expect(hasUnread(null, null, null)).toBe(false);
    });

    it('asks for the newest notification of the types shown, and the read marker', async () => {
        serve('200', '100');
        expect(await getNewestNotificationId(['mention', 'follow'])).toBe('200');
        expect(await getNotificationsMarker()).toBe('100');

        expect(api.get).toHaveBeenCalledWith('/notifications', { params: { limit: 1, types: ['mention', 'follow'] } });
        expect(api.get).toHaveBeenCalledWith('/markers', { params: { timeline: ['notifications'] } });
    });

    it('clears once the tab shows the newest one, and remembers it per account', async () => {
        serve('200', '100');
        let markSeen: (id: string) => Promise<void> = async () => {};
        const Probe = () => {
            const unread = useUnreadNotifications();
            markSeen = useMarkNotificationsSeen();
            return <Text testID="unread">{String(unread)}</Text>;
        };
        await render(
            <QueryClientProvider client={createTestQueryClient()}>
                <Probe />
            </QueryClientProvider>
        );

        await waitFor(() => expect(screen.getByTestId('unread').props.children).toBe('true'));
        await act(() => markSeen('200'));

        // React Query tells the screen on its next tick
        await waitFor(() => expect(screen.getByTestId('unread').props.children).toBe('false'));
        expect(await AsyncStorage.getItem('pugdom_notifications_seen_me')).toBe('200');
    });
});

describe('Bell', () => {
    const renderBar = (activeTab: 'home' | 'notifications', unreadNotifications: boolean) =>
        render(<TabBar activeTab={activeTab} onTabPress={jest.fn()} onComposePress={jest.fn()} unreadNotifications={unreadNotifications} />);

    it('shows a dot, and says so, when there are new notifications', async () => {
        await renderBar('home', true);

        expect(screen.getByTestId('unread-dot')).toBeTruthy();
        expect(screen.getByRole('tab', { name: 'Notifications, new' })).toBeTruthy();
    });

    it('has no dot when there is nothing new, or on the open tab', async () => {
        await renderBar('home', false);
        expect(screen.queryByTestId('unread-dot')).toBeNull();

        await renderBar('notifications', true);
        expect(screen.queryByTestId('unread-dot')).toBeNull();
        expect(screen.getByRole('tab', { name: 'Notifications' })).toBeTruthy();
    });
});
