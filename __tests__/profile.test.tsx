import React from 'react';
import { DeviceEventEmitter, Text } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { createTestQueryClient } from '../testUtils/queryClient';
import Profile, { fullHandle } from '../screens/Profile/profile';
import { getAccountStatuses } from '../services/mastodon/accounts';
import { getBookmarks } from '../services/mastodon/bookmarks';
import { MediaViewerProvider } from '../components/MediaViewer/mediaViewer';
import { NavigationProvider, useNavigator } from '../services/navigationContext';
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
jest.mock('../services/mastodon/bookmarks', () => ({ getBookmarks: jest.fn() }));
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
    mediaLabel: jest.requireActual('../components/TootCard/tootCard').mediaLabel,
}));

const mockedStatuses = getAccountStatuses as jest.MockedFunction<typeof getAccountStatuses>;
const mockedBookmarks = getBookmarks as jest.MockedFunction<typeof getBookmarks>;
const status = (id: string, extra: Partial<Status> = {}) => ({ id, content: `post ${id}`, media_attachments: [], ...extra } as Status);

describe('Profile', () => {
    let queryClient: QueryClient;

    const renderProfile = (props: React.ComponentProps<typeof Profile> = {}) => {
        queryClient = createTestQueryClient();
        return render(
            <QueryClientProvider client={queryClient}>
                <MediaViewerProvider>
                    <Profile {...props} />
                </MediaViewerProvider>
            </QueryClientProvider>
        );
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockUser = me;
        mockedStatuses.mockResolvedValue([status('1')]);
    });

    it('shows the Media tab as a grid with a thumbnail per post that opens the viewer, or the post on a long press', async () => {
        const image = (id: string) => ({ id, type: 'image', url: `https://x/${id}.png`, preview_url: `https://x/${id}-small.png` });
        const onStatusPress = jest.fn();
        mockedStatuses.mockResolvedValue([status('1', { media_attachments: [image('a'), image('b')] as any }), status('2', { media_attachments: [image('c')] as any, sensitive: true })]);
        await renderProfile({ onStatusPress });
        await screen.findByText('post 1');

        await fireEvent.press(screen.getByRole('tab', { name: 'Media' }));

        // One thumbnail per post: its first picture, saying how many there are
        expect(await screen.findByRole('imagebutton', { name: 'Image 1 of 2' })).toBeTruthy();
        expect(screen.getAllByRole('imagebutton')).toHaveLength(2);
        expect(screen.getByText('2')).toBeTruthy();
        expect(screen.queryByText('post 1')).toBeNull();
        // Sensitive pictures stay blurred in the grid
        expect(screen.getByTestId('focused-image-blurred', { includeHiddenElements: true })).toBeTruthy();

        await fireEvent(screen.getByRole('imagebutton', { name: 'Image 1 of 1' }), 'longPress');
        expect(onStatusPress).toHaveBeenCalledWith('2');
    });

    it("shows the roles the server highlights, with a happy pug for supporters", async () => {
        mockUser = { ...me, roles: [{ id: '1', name: 'Server supporter', color: '' }, { id: '2', name: 'Moderator', color: '#7A1F1F' }] };
        await renderProfile();

        expect(await screen.findByLabelText('Role: Server supporter')).toBeTruthy();
        expect(screen.getByLabelText('Role: Moderator')).toBeTruthy();
        expect(screen.getAllByTestId('pug-happy-eye', { includeHiddenElements: true })).toHaveLength(1);
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

    it('lists your bookmarks on the Bookmarks tab', async () => {
        mockedBookmarks.mockResolvedValue({ statuses: [status('b1')], nextMaxId: '5' });
        await renderProfile();
        await screen.findByText('post 1');
        // Not fetched until the tab is opened
        expect(mockedBookmarks).not.toHaveBeenCalled();

        await fireEvent.press(screen.getByRole('tab', { name: 'Bookmarks' }));

        expect(await screen.findByText('post b1')).toBeTruthy();
        expect(screen.queryByText('post 1')).toBeNull();
        expect(mockedBookmarks).toHaveBeenCalledWith(undefined);
        expect(screen.getByRole('tab', { name: 'Bookmarks' })).toBeSelected();
    });

    it('says when there are no bookmarks', async () => {
        mockedBookmarks.mockResolvedValue({ statuses: [] });
        await renderProfile();
        await screen.findByText('post 1');

        await fireEvent.press(screen.getByRole('tab', { name: 'Bookmarks' }));

        expect(await screen.findByText('No bookmarks yet')).toBeTruthy();
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

    it('opens the in-app profile editor from Edit profile', async () => {
        const StackProbe = () => <Text testID="stack">{JSON.stringify(useNavigator().stack.map(entry => entry.route))}</Text>;
        queryClient = createTestQueryClient();
        await render(
            <QueryClientProvider client={queryClient}>
                <NavigationProvider>
                    <MediaViewerProvider>
                        <Profile />
                        <StackProbe />
                    </MediaViewerProvider>
                </NavigationProvider>
            </QueryClientProvider>
        );

        await fireEvent.press(await screen.findByRole('button', { name: 'Edit profile' }));

        expect(JSON.parse(String(screen.getByTestId('stack').props.children))).toEqual([{ name: 'editProfile' }]);
        expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
    });

    it('has no Settings button on the banner, since the top bar above the tab has one', async () => {
        await renderProfile();
        await screen.findByRole('button', { name: 'Edit profile' });

        expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull();
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
