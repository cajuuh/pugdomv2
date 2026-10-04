import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils/queryClient';
import apiClient from '../services/api/client';
import Search from '../screens/Search/search';
import { search, shouldResolve } from '../services/mastodon/search';
import { NavigationProvider, useNavigator } from '../services/navigationContext';
import { Status } from '../services/mastodon/types';

jest.mock('../services/api/client', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
jest.mock('../services/storage', () => ({
    getCredentials: jest.fn().mockResolvedValue({ accessToken: 't', instanceUrl: 'https://pug.social' }),
}));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
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

const get = apiClient.get as jest.Mock;
const ana = { id: 'ana', username: 'ana', acct: 'ana@art.social', display_name: 'Ana', avatar: '', emojis: [] };
const pugs = { name: 'pugs', url: 'https://pug.social/tags/pugs', history: [{ day: '1', uses: '4', accounts: '2' }] };
const postResult = { id: 'p1', content: 'pugs are great' };

// /api/v2/search → results; /accounts/relationships → not following anyone
const serve = (results: object) =>
    get.mockImplementation(async (url: string, config?: any) => {
        if (url.includes('/api/v2/search')) {
            const type = config?.params?.type;
            const all = { accounts: [ana], hashtags: [pugs], statuses: [postResult], ...results } as any;
            return { data: type ? { [type]: all[type] } : all };
        }
        if (url.includes('/trends/statuses') || url.includes('/trends/tags') || url.includes('/trends/links') || url.includes('/suggestions')) {
            return { data: [] };
        }
        return { data: [{ id: 'ana', following: false, requested: false, followed_by: false }] };
    });

beforeEach(() => jest.clearAllMocks());

describe('search service', () => {
    it('asks the v2 endpoint, only resolving when asked', async () => {
        get.mockResolvedValue({ data: { accounts: [] } });

        await search({ q: 'pugs', limit: 5 });
        await search({ q: 'pugs', type: 'statuses', limit: 20, offset: 20, resolve: true });

        expect(get).toHaveBeenNthCalledWith(1, 'https://pug.social/api/v2/search', { params: { q: 'pugs', type: undefined, resolve: undefined, limit: 5, offset: undefined } });
        expect(get).toHaveBeenNthCalledWith(2, 'https://pug.social/api/v2/search', { params: { q: 'pugs', type: 'statuses', resolve: true, limit: 20, offset: 20 } });
    });

    it('fills in missing result kinds', async () => {
        get.mockResolvedValue({ data: { accounts: [ana] } });
        expect(await search({ q: 'ana' })).toEqual({ accounts: [ana], hashtags: [], statuses: [] });
    });

    it('resolves @user@server and links, not plain words', () => {
        expect(shouldResolve('@ana@art.social')).toBe(true);
        expect(shouldResolve('ana@art.social')).toBe(true);
        expect(shouldResolve('https://art.social/@ana/123')).toBe(true);
        expect(shouldResolve('pugs')).toBe(false);
        expect(shouldResolve('@ana')).toBe(false);
    });
});

describe('Search screen', () => {
    const StackProbe = () => {
        const { stack } = useNavigator();
        const { Text: MockText } = jest.requireActual('react-native');
        return <MockText testID="stack">{JSON.stringify(stack.map(entry => entry.route))}</MockText>;
    };
    const renderSearch = (onStatusPress = jest.fn()) =>
        render(
            <QueryClientProvider client={createTestQueryClient()}>
                <NavigationProvider>
                    <Search onStatusPress={onStatusPress} />
                    <StackProbe />
                </NavigationProvider>
            </QueryClientProvider>
        );
    const type = async (text: string) => {
        await fireEvent.changeText(screen.getByLabelText('Search people, hashtags and posts'), text);
    };

    it('shows explore tabs before anything is typed', async () => {
        serve({});
        await renderSearch();
        expect(screen.getByText('Posts')).toBeTruthy();
        expect(screen.getByText('Hashtags')).toBeTruthy();
        expect(screen.getByText('News')).toBeTruthy();
        expect(screen.getByText('People')).toBeTruthy();
    });

    it('shows people, hashtags and posts for a query', async () => {
        serve({});
        await renderSearch();
        await type('pugs');

        expect(await screen.findByText('Ana')).toBeTruthy();
        expect(screen.getByText('#pugs')).toBeTruthy();
        expect(screen.getByText('4 posts by 2 people this week')).toBeTruthy();
        expect(screen.getByText('pugs are great')).toBeTruthy();
        expect(await screen.findByRole('button', { name: 'Follow' })).toBeTruthy();
        // Plain words aren't looked up on other servers
        expect(get).toHaveBeenCalledWith('https://pug.social/api/v2/search', expect.objectContaining({ params: expect.objectContaining({ resolve: undefined, limit: 5 }) }));
    });

    it('jumps to a tab from "See all" and pages through that kind', async () => {
        serve({});
        await renderSearch();
        await type('pugs');
        await screen.findByText('Ana');

        await fireEvent.press(screen.getByRole('button', { name: 'See all People' }));

        await waitFor(() =>
            expect(get).toHaveBeenCalledWith('https://pug.social/api/v2/search', { params: { q: 'pugs', type: 'accounts', resolve: undefined, limit: 20, offset: 0 } })
        );
        expect(screen.getByRole('button', { name: 'People' })).toBeSelected();
    });

    it('explains that post search depends on the server when nothing comes back', async () => {
        serve({ accounts: [], hashtags: [], statuses: [] });
        await renderSearch();
        await type('xyzzy');

        expect(await screen.findByText('Nothing found for "xyzzy"')).toBeTruthy();
        expect(screen.getByText(/Post search depends on your server/)).toBeTruthy();
    });

    it('opens people and hashtags from the results', async () => {
        serve({});
        await renderSearch();
        await type('pugs');
        await fireEvent.press(await screen.findByRole('link', { name: "Ana's profile" }));
        await fireEvent.press(screen.getByRole('link', { name: /^#pugs/ }));

        expect(JSON.parse(screen.getByTestId('stack').props.children)).toEqual([
            { name: 'account', accountId: 'ana', account: ana },
            { name: 'hashtag', tag: 'pugs' },
        ]);
    });

    it('looks up a pasted post link on other servers and opens it', async () => {
        serve({ accounts: [], hashtags: [], statuses: [postResult] });
        const onStatusPress = jest.fn();
        await renderSearch(onStatusPress);

        await type('https://art.social/@ana/123');

        await waitFor(() => expect(onStatusPress).toHaveBeenCalledWith('p1'));
        expect(get).toHaveBeenCalledWith('https://pug.social/api/v2/search', expect.objectContaining({ params: expect.objectContaining({ resolve: true }) }));
    });

    it('looks up plain words on other servers when search is pressed', async () => {
        serve({});
        await renderSearch();
        await type('pugs');
        await screen.findByText('Ana');

        await act(async () => {
            fireEvent(screen.getByLabelText('Search people, hashtags and posts'), 'submitEditing');
        });

        await waitFor(() =>
            expect(get).toHaveBeenCalledWith('https://pug.social/api/v2/search', expect.objectContaining({ params: expect.objectContaining({ q: 'pugs', resolve: true }) }))
        );
    });
});

describe('links to posts and profiles from any server', () => {
    const { fediverseLinkKind } = jest.requireActual('../services/mastodon/search');
    const { useOpenAccount } = jest.requireActual('../hooks/useOpenAccount');
    const WebBrowser = jest.requireMock('expo-web-browser');

    it('recognises post and profile links on Mastodon and friends', () => {
        expect(fediverseLinkKind('https://art.social/@ana/113004512345678901')).toBe('post');
        expect(fediverseLinkKind('https://art.social/@ana@other.social/113004512345678901')).toBe('post');
        expect(fediverseLinkKind('https://art.social/users/ana/statuses/113004512345678901')).toBe('post');
        expect(fediverseLinkKind('https://pleroma.example/notice/AbC123')).toBe('post');
        expect(fediverseLinkKind('https://misskey.example/notes/9abc')).toBe('post');
        expect(fediverseLinkKind('https://art.social/@ana')).toBe('profile');
        expect(fediverseLinkKind('https://art.social/users/ana/')).toBe('profile');
        expect(fediverseLinkKind('https://news.example/2026/10/03/story')).toBeNull();
        expect(fediverseLinkKind('https://art.social/@ana/media')).toBeNull();
    });

    const renderOpen = () =>
        jest.requireActual('@testing-library/react-native').renderHook(
            () => ({ open: useOpenAccount(), nav: useNavigator() }),
            { wrapper: ({ children }: { children: React.ReactNode }) => <NavigationProvider>{children}</NavigationProvider> }
        );

    it('opens a post from another server as a thread', async () => {
        get.mockResolvedValue({ data: { statuses: [{ id: 'local-99' }] } });
        const { result } = await renderOpen();

        await act(async () => {
            await result.current.open.openLinkInApp('https://art.social/@ana/123');
        });

        expect(get).toHaveBeenCalledWith('https://pug.social/api/v2/search', { params: { q: 'https://art.social/@ana/123', type: 'statuses', resolve: true, limit: 1, offset: undefined } });
        expect(result.current.nav.stack.map((entry: any) => entry.route)).toEqual([{ name: 'thread', statusId: 'local-99' }]);
    });

    it('opens other links, or posts it cannot find, in the browser', async () => {
        get.mockResolvedValue({ data: { statuses: [] } });
        const { result } = await renderOpen();

        await act(async () => {
            await result.current.open.openLinkInApp('https://art.social/@ana/123');
            await result.current.open.openLinkInApp('https://news.example/story');
        });

        expect(result.current.nav.stack).toHaveLength(0);
        expect(get).toHaveBeenCalledTimes(1);
        expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://art.social/@ana/123');
        expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://news.example/story');
    });
});
