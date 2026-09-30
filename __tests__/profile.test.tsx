import React from 'react';
import { DeviceEventEmitter } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { createTestQueryClient } from '../testUtils/queryClient';
import Profile, { fullHandle } from '../screens/Profile/profile';
import { getAccountStatuses } from '../services/mastodon/accounts';
import { Account, Status } from '../services/mastodon/types';

const me: Account = {
    id: '7',
    username: 'cajuuh',
    acct: 'cajuuh',
    display_name: 'pedro',
    avatar: '',
    url: 'https://mastodon.social/@cajuuh',
    note: '<p>pugs and code</p>',
    statuses_count: 1204,
    following_count: 312,
    followers_count: 889,
    emojis: [],
};
let mockUser: Account = me;

jest.mock('../services/authContext', () => ({
    useAuth: () => ({ user: mockUser, checkLoginStatus: jest.fn().mockResolvedValue(undefined) }),
}));
jest.mock('../services/themeContext', () => ({
    useTheme: () => jest.requireActual('../testUtils/theme').mockTheme,
}));
jest.mock('../services/mastodon/accounts', () => ({ getAccountStatuses: jest.fn() }));
jest.mock('../services/storage', () => ({
    getCredentials: jest.fn().mockResolvedValue({ accessToken: 't', instanceUrl: 'https://mastodon.social' }),
}));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
// The cards have their own tests; here we only need to see which statuses are listed
jest.mock('../components/TootCard/tootCard', () => ({
    TootCard: ({ status }: { status: Status }) => {
        const { Text: MockText } = jest.requireActual('react-native');
        return <MockText>{status.content}</MockText>;
    },
}));

const mockedStatuses = getAccountStatuses as jest.MockedFunction<typeof getAccountStatuses>;
const status = (id: string) => ({ id, content: `post ${id}` } as Status);

describe('Profile', () => {
    let queryClient: QueryClient;

    const renderProfile = (props: React.ComponentProps<typeof Profile> = {}) => {
        queryClient = createTestQueryClient();
        return render(
            <QueryClientProvider client={queryClient}>
                <Profile {...props} />
            </QueryClientProvider>
        );
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockUser = me;
        mockedStatuses.mockResolvedValue([status('1')]);
    });

    it("lists the account's posts without replies first", async () => {
        await renderProfile();

        expect(await screen.findByText('post 1')).toBeTruthy();
        expect(mockedStatuses).toHaveBeenCalledWith('7', undefined, { exclude_replies: true });
        expect(screen.getByRole('tab', { name: 'Posts' })).toBeSelected();
    });

    it.each([
        ['Replies', {}],
        ['Media', { only_media: true }],
    ] as const)('asks for the right posts on the %s tab', async (tab, filter) => {
        await renderProfile();
        await screen.findByText('post 1');

        await fireEvent.press(screen.getByRole('tab', { name: tab }));

        await waitFor(() => expect(mockedStatuses).toHaveBeenLastCalledWith('7', undefined, filter));
        expect(screen.getByRole('tab', { name: tab })).toBeSelected();
        expect(screen.getByRole('tab', { name: 'Posts' })).not.toBeSelected();
    });

    it('says when a tab is empty', async () => {
        mockedStatuses.mockResolvedValue([]);
        await renderProfile();
        expect(await screen.findByText('No posts yet')).toBeTruthy();

        await fireEvent.press(screen.getByRole('tab', { name: 'Media' }));
        expect(await screen.findByText('No media yet')).toBeTruthy();
    });

    it('shows the full handle, bio and an inline stats row', async () => {
        await renderProfile();
        await screen.findByText('post 1');

        expect(screen.getByText('@cajuuh@mastodon.social')).toBeTruthy();
        expect(screen.getByText('pugs and code')).toBeTruthy();
        expect(screen.getByText('1,204')).toBeTruthy();
        expect(screen.getByText('312')).toBeTruthy();
        expect(screen.getByText('889')).toBeTruthy();
    });

    it('no longer has a log out button', async () => {
        await renderProfile();
        await screen.findByText('post 1');

        expect(screen.queryByText(/log out/i)).toBeNull();
    });

    it("opens the instance's profile settings from Edit profile", async () => {
        await renderProfile();

        await fireEvent.press(await screen.findByRole('button', { name: 'Edit profile' }));

        await waitFor(() => expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://mastodon.social/settings/profile'));
    });

    it('opens Settings from the banner', async () => {
        const onSettingsPress = jest.fn();
        await renderProfile({ onSettingsPress });

        await fireEvent.press(await screen.findByRole('button', { name: 'Settings' }));

        expect(onSettingsPress).toHaveBeenCalled();
    });

    it.each([
        ['no header', undefined, 'profile-banner-mark'],
        ["Mastodon's placeholder", 'https://mastodon.social/headers/original/missing.png', 'profile-banner-mark'],
        ['a header image', 'https://files.mastodon.social/header.jpg', 'profile-banner-image'],
    ])('shows the right banner for %s', async (_, header, testId) => {
        mockUser = { ...me, header };
        await renderProfile();
        await screen.findByText('post 1');

        expect(screen.getByTestId(testId)).toBeTruthy();
    });

    it('reloads its posts after you publish one', async () => {
        await renderProfile();
        await screen.findByText('post 1');
        mockedStatuses.mockResolvedValue([status('2'), status('1')]);

        await act(async () => {
            DeviceEventEmitter.emit('status_published');
        });

        expect(await screen.findByText('post 2')).toBeTruthy();
    });

    it('builds the full handle from the profile URL', () => {
        expect(fullHandle(me)).toBe('@cajuuh@mastodon.social');
        expect(fullHandle({ ...me, acct: 'bob@floss.social' })).toBe('@bob@floss.social');
        expect(fullHandle({ ...me, url: undefined })).toBe('@cajuuh');
    });
});
