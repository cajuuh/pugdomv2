import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils/queryClient';
import apiClient from '../services/api/client';
import ModeratedAccounts from '../screens/Moderated/moderatedAccounts';
import { NavigationProvider } from '../services/navigationContext';
import { Account } from '../services/mastodon/types';

jest.mock('../services/api/client', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
jest.mock('../services/themeContext', () => ({
    useTheme: () => jest.requireActual('../testUtils/theme').mockTheme,
}));

const api = apiClient as unknown as Record<'get' | 'post', jest.Mock>;
const ana: Account = { id: 'ana', username: 'ana', acct: 'ana@art.social', display_name: 'Ana', avatar: '', emojis: [] };
const bo: Account = { id: 'bo', username: 'bo', acct: 'bo', display_name: 'Bo', avatar: '', emojis: [] };

const renderScreen = () =>
    render(
        <QueryClientProvider client={createTestQueryClient()}>
            <NavigationProvider>
                <ModeratedAccounts onBack={jest.fn()} />
            </NavigationProvider>
        </QueryClientProvider>
    );

beforeEach(() => {
    jest.clearAllMocks();
    let muted = [{ ...ana, mute_expires_at: '2026-11-08T15:30:00Z' }, { ...bo, mute_expires_at: null }];
    api.get.mockImplementation(async (url: string) => ({ data: url === '/mutes' ? muted : url === '/blocks' ? [] : [], headers: {} }));
    api.post.mockImplementation(async (url: string) => {
        if (url === '/accounts/ana/unmute') muted = muted.filter(account => account.id !== 'ana');
        return { data: { id: 'ana', muting: false } };
    });
});

describe('Muted and blocked accounts', () => {
    it('lists who you muted, with when a timed mute ends', async () => {
        await renderScreen();

        expect(await screen.findByText('Ana')).toBeTruthy();
        expect(screen.getByText('Bo')).toBeTruthy();
        expect(screen.getByText(/^Until /)).toBeTruthy();
        expect(screen.getAllByText(/^Until /)).toHaveLength(1);
        expect(api.get).toHaveBeenCalledWith('/mutes', { params: { max_id: undefined, limit: 80 } });
    });

    it('unmutes someone, and they leave the list', async () => {
        await renderScreen();
        await fireEvent.press(await screen.findByRole('button', { name: 'Unmute Ana' }));

        expect(api.post).toHaveBeenCalledWith('/accounts/ana/unmute');
        await waitFor(() => expect(screen.queryByText('Ana')).toBeNull());
        expect(screen.getByText('Bo')).toBeTruthy();
    });

    it('shows who you blocked on the other tab', async () => {
        await renderScreen();
        await screen.findByText('Ana');

        await fireEvent.press(screen.getByRole('tab', { name: 'Blocked' }));

        expect(await screen.findByText("You haven't blocked anyone")).toBeTruthy();
        expect(api.get).toHaveBeenCalledWith('/blocks', { params: { max_id: undefined, limit: 80 } });
    });
});
