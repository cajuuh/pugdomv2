import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils/queryClient';
import { publicClient } from '../services/api/client';
import { DirectoryServer, matchServers } from '../services/mastodon/servers';
import Login from '../screens/Login/login';

jest.mock('../services/api/client', () => ({
    __esModule: true,
    default: { get: jest.fn(), post: jest.fn() },
    publicClient: { get: jest.fn() },
}));
jest.mock('../services/authContext', () => ({ useAuth: () => ({ login: jest.fn() }) }));
jest.mock('../services/themeContext', () => ({
    useTheme: () => jest.requireActual('../testUtils/theme').mockTheme,
}));
const mockSaved: { instanceUrl: string }[] = [];
jest.mock('../services/storage', () => ({ getSavedAccounts: async () => mockSaved, saveCredentials: jest.fn() }));
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn(), openAuthSessionAsync: jest.fn() }));

const directory: DirectoryServer[] = [
    { domain: 'mastodon.social', total_users: 921100 },
    { domain: 'mstdn.social', total_users: 176523 },
    { domain: 'mastodon.online', total_users: 200000 },
    { domain: 'fosstodon.org', total_users: 60000 },
    { domain: 'social.mastodon.party', total_users: 10 },
];

describe('matchServers', () => {
    it('puts addresses starting with what is typed first, then the biggest', () => {
        expect(matchServers(directory, 'mas').map(server => server.domain)).toEqual(['mastodon.social', 'mastodon.online', 'social.mastodon.party']);
        expect(matchServers(directory, 'https://Mastodon.O').map(server => server.domain)).toEqual(['mastodon.online']);
    });

    it('puts servers you already have an account on first, even ones the directory lacks', () => {
        expect(matchServers(directory, 'o', 3, ['bolha.one', 'mastodon.social'])).toEqual([
            { domain: 'bolha.one', mine: true },
            { domain: 'mastodon.social', mine: true },
            { domain: 'mastodon.online', total_users: 200000 },
        ]);
        expect(matchServers(directory, 'bolha.one', 5, ['bolha.one'])).toEqual([]);
    });

    it('suggests nothing for an empty field or a server typed in full', () => {
        expect(matchServers(directory, '  ')).toEqual([]);
        expect(matchServers(directory, 'fosstodon.org')).toEqual([]);
    });
});

describe('Sign-in server suggestions', () => {
    beforeEach(() => {
        (publicClient.get as jest.Mock).mockResolvedValue({ data: directory });
        mockSaved.length = 0;
    });

    const renderLogin = () =>
        render(
            <QueryClientProvider client={createTestQueryClient()}>
                <Login />
            </QueryClientProvider>
        );

    it('lists matching servers as you type, and fills the address when one is tapped', async () => {
        await renderLogin();
        const field = screen.getByPlaceholderText('e.g. mastodon.social');
        await fireEvent.changeText(field, 'fos');

        const pick = await screen.findByRole('button', { name: 'fosstodon.org, 60,000 people' });
        await fireEvent.press(pick);

        expect(field.props.value).toBe('fosstodon.org');
        expect(screen.queryByRole('button', { name: /fosstodon\.org,/ })).toBeNull();
    });

    it("suggests the servers of accounts already on the phone, first", async () => {
        mockSaved.push({ instanceUrl: 'https://bolha.one' }, { instanceUrl: 'https://bolha.one/' });
        await renderLogin();
        await fireEvent.changeText(screen.getByPlaceholderText('e.g. mastodon.social'), 'bol');

        expect(await screen.findByRole('button', { name: 'bolha.one, You have an account here' })).toBeTruthy();
        expect(screen.getAllByRole('button', { name: /^bolha\.one,/ })).toHaveLength(1);
    });

    it('keeps working for a server the directory does not know', async () => {
        await renderLogin();
        await fireEvent.changeText(screen.getByPlaceholderText('e.g. mastodon.social'), 'bolha.one');
        expect(screen.queryByRole('button', { name: /people/ })).toBeNull();
        expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
    });
});
