import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils/queryClient';
import apiClient from '../services/api/client';
import { getReactions } from '../services/mastodon/statuses';
import { MediaViewerProvider } from '../components/MediaViewer/mediaViewer';
import Reactions, { matchesSearch } from '../screens/Reactions/reactions';
import Thread from '../screens/Thread/thread';
import { TootCard } from '../components/TootCard/tootCard';
import { NavigationProvider, useNavigator } from '../services/navigationContext';
import { Account, Status } from '../services/mastodon/types';

jest.mock('../services/api/client', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
const me: Account = { id: 'me', username: 'me', acct: 'me', display_name: 'Me', avatar: '', emojis: [] };
jest.mock('../services/authContext', () => ({ useAuth: () => ({ user: me }), useOptionalAuth: () => ({ user: me }) }));
jest.mock('../services/themeContext', () => ({
    useTheme: () => jest.requireActual('../testUtils/theme').mockTheme,
}));
const mockSettings = { compactMode: false, mediaAutoplay: false, hideCounts: false };
jest.mock('../services/settingsContext', () => ({ useSettings: () => mockSettings }));
jest.mock('../services/composeContext', () => ({ useCompose: () => ({ openCompose: jest.fn() }) }));

const api = apiClient as unknown as Record<'get' | 'post', jest.Mock>;
const ana: Account = { id: 'ana', username: 'ana', acct: 'ana@art.social', display_name: 'Ana', avatar: '', emojis: [] };
const post = (extra: Partial<Status> = {}) =>
    ({
        id: 'p1',
        created_at: new Date().toISOString(),
        spoiler_text: '',
        visibility: 'public',
        content: '<p>Pugs rule</p>',
        replies_count: 0,
        reblogs_count: 0,
        favourites_count: 0,
        account: me,
        media_attachments: [],
        emojis: [],
        ...extra,
    }) as Status;

const StackProbe = () => <Text testID="stack">{JSON.stringify(useNavigator().stack.map(entry => entry.route))}</Text>;
const wrap = (children: React.ReactNode) => (
    <QueryClientProvider client={createTestQueryClient()}>
        <NavigationProvider>
            <MediaViewerProvider>
                {children}
                <StackProbe />
            </MediaViewerProvider>
        </NavigationProvider>
    </QueryClientProvider>
);
const stack = () => JSON.parse(String(screen.getByTestId('stack').props.children));

beforeEach(() => {
    jest.clearAllMocks();
    mockSettings.hideCounts = false;
});

describe('getReactions', () => {
    it('asks for who favourited or boosted, paged with the Link header', async () => {
        api.get.mockResolvedValue({ data: [ana], headers: { link: '<https://home.social/api/v1/statuses/p1/reblogged_by?max_id=9>; rel="next"' } });

        await expect(getReactions('p1', 'boosts')).resolves.toEqual({ accounts: [ana], nextMaxId: '9' });
        expect(api.get).toHaveBeenCalledWith('/statuses/p1/reblogged_by', { params: { max_id: undefined } });

        await getReactions('p1', 'favourites', '5');
        expect(api.get).toHaveBeenLastCalledWith('/statuses/p1/favourited_by', { params: { max_id: '5' } });
    });
});

describe('Thread', () => {
    const renderThread = async (status: Status) => {
        api.get.mockImplementation(async (url: string) => {
            if (url === '/statuses/p1') return { data: status };
            if (url === '/statuses/p1/context') return { data: { ancestors: [], descendants: [] } };
            return { data: [], headers: {} };
        });
        await render(wrap(<Thread statusId="p1" onBack={jest.fn()} onStatusPress={jest.fn()} />));
    };

    it('links to who favourited and boosted the post, leaving out what nobody did', async () => {
        await renderThread(post({ favourites_count: 3, reblogs_count: 1 }));

        await fireEvent.press(await screen.findByRole('button', { name: '3 favourites' }));
        expect(stack()).toEqual([{ name: 'reactions', statusId: 'p1', reaction: 'favourites' }]);

        await fireEvent.press(screen.getByRole('button', { name: '1 boost' }));
        expect(stack()[1]).toEqual({ name: 'reactions', statusId: 'p1', reaction: 'boosts' });
        expect(screen.queryByRole('button', { name: /quote/ })).toBeNull();
    });

    it('shows the first three who favourited as small avatars on the link', async () => {
        const people = ['a', 'b', 'c', 'd'].map(id => ({ ...ana, id, display_name: `Person ${id}` }));
        api.get.mockImplementation(async (url: string, config?: { params?: { limit?: number } }) => {
            if (url === '/statuses/p1') return { data: post({ favourites_count: 12, reblogs_count: 0 }) };
            if (url === '/statuses/p1/context') return { data: { ancestors: [], descendants: [] } };
            if (url === '/statuses/p1/favourited_by') return { data: people.slice(0, config?.params?.limit), headers: {} };
            return { data: [], headers: {} };
        });
        await render(wrap(<Thread statusId="p1" onBack={jest.fn()} onStatusPress={jest.fn()} />));

        expect(await screen.findByRole('button', { name: '12 favourites' })).toBeTruthy();
        expect(api.get).toHaveBeenCalledWith('/statuses/p1/favourited_by', { params: { max_id: undefined, limit: 3 } });
        // Nobody boosted, so nobody is asked for
        expect(api.get).not.toHaveBeenCalledWith('/statuses/p1/reblogged_by', expect.anything());
        expect(await screen.findByLabelText('Person c', { includeHiddenElements: true })).toBeTruthy();
        expect(screen.queryByLabelText('Person d', { includeHiddenElements: true })).toBeNull();
    });

    it('keeps the links without numbers when numbers are hidden', async () => {
        mockSettings.hideCounts = true;
        await renderThread(post({ favourites_count: 3, reblogs_count: 1, quotes_count: 2 }));

        expect(await screen.findByRole('button', { name: 'Favourites' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Boosts' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Quotes' })).toBeTruthy();
        expect(screen.queryByText('3 favourites')).toBeNull();
    });
});

describe('TootCard reactions', () => {
    it('shows who favourited and boosted your own posts in timelines', async () => {
        await render(wrap(<TootCard status={post({ favourites_count: 2, reblogs_count: 1 })} />));

        expect(await screen.findByRole('button', { name: '2 favourites' })).toBeTruthy();
        expect(screen.getByRole('button', { name: '1 boost' })).toBeTruthy();
    });

    it("leaves them off other people's posts, without asking the server", async () => {
        await render(wrap(<TootCard status={post({ account: ana, favourites_count: 2, reblogs_count: 1 })} />));

        expect(screen.queryByRole('button', { name: '2 favourites' })).toBeNull();
        expect(api.get).not.toHaveBeenCalledWith('/statuses/p1/favourited_by', expect.anything());
    });
});

describe('Reactions', () => {
    it('lists the people, with a follow button for everyone but you', async () => {
        api.get.mockImplementation(async (url: string) => {
            if (url === '/statuses/p1/favourited_by') return { data: [ana, me], headers: {} };
            if (url === '/accounts/relationships') return { data: [{ id: 'ana', following: false, requested: false, followed_by: false }] };
            return { data: [], headers: {} };
        });
        await render(wrap(<Reactions id="p1" kind="favourites" onBack={jest.fn()} />));

        expect(screen.getByRole('header', { name: 'Favourited by' })).toBeTruthy();
        expect(await screen.findByText('@ana@art.social')).toBeTruthy();
        expect(screen.getByText('@me')).toBeTruthy();
        // The follow state comes from a second request, after the list
        expect(await screen.findAllByRole('button', { name: /Follow/ })).toHaveLength(1);
    });

    it("lists someone's followers, a page at a time", async () => {
        api.get.mockImplementation(async (url: string, config?: { params?: { max_id?: string } }) => {
            if (url === '/accounts/ana/followers') {
                return config?.params?.max_id === '77'
                    ? { data: [{ ...me, id: 'bo', username: 'bo', acct: 'bo' }], headers: {} }
                    : { data: [ana], headers: { link: '<https://home.social/api/v1/accounts/ana/followers?max_id=77>; rel="next"' } };
            }
            return { data: [], headers: {} };
        });
        await render(wrap(<Reactions id="ana" kind="followers" onBack={jest.fn()} />));

        expect(screen.getByRole('header', { name: 'Followers' })).toBeTruthy();
        expect(await screen.findByText('@ana@art.social')).toBeTruthy();
        expect(api.get).toHaveBeenCalledWith('/accounts/ana/followers', { params: { max_id: undefined, limit: 80 } });
    });

    it('searches the whole list by name or handle, loading the rest of it first', async () => {
        const jose = { ...me, id: 'jose', username: 'jose', acct: 'jose@bolha.one', display_name: 'José Pug' };
        api.get.mockImplementation(async (url: string, config?: { params?: { max_id?: string } }) => {
            if (url === '/accounts/ana/following') {
                return config?.params?.max_id === '77'
                    ? { data: [jose], headers: {} }
                    : { data: [ana], headers: { link: '<https://home.social/api/v1/accounts/ana/following?max_id=77>; rel="next"' } };
            }
            return { data: [], headers: {} };
        });
        await render(wrap(<Reactions id="ana" kind="following" onBack={jest.fn()} />));
        expect(await screen.findByText('@ana@art.social')).toBeTruthy();

        // José is on the second page, not loaded yet
        await fireEvent.changeText(screen.getByLabelText('Search following'), 'jose');
        expect(await screen.findByText('@jose@bolha.one')).toBeTruthy();
        expect(screen.queryByText('@ana@art.social')).toBeNull();
        expect(api.get).toHaveBeenCalledWith('/accounts/ana/following', { params: { max_id: '77', limit: 80 } });

        await fireEvent.changeText(screen.getByLabelText('Search following'), 'nobody');
        expect(await screen.findByText('Nobody here matches that name.')).toBeTruthy();

        await fireEvent.press(screen.getByRole('button', { name: 'Clear search' }));
        expect(screen.getByText('@ana@art.social')).toBeTruthy();
    });

    it('matches names and handles without caring about case or accents', () => {
        const jose = { display_name: 'José Pug', username: 'jose', acct: 'jose@bolha.one' };
        expect(matchesSearch(jose, 'JOSE')).toBe(true);
        expect(matchesSearch(jose, ' pug ')).toBe(true);
        expect(matchesSearch(jose, 'bolha')).toBe(true);
        expect(matchesSearch(jose, 'ana')).toBe(false);
    });

    it("doesn't offer a search on favourites and boosts", async () => {
        api.get.mockResolvedValue({ data: [ana], headers: {} });
        await render(wrap(<Reactions id="p1" kind="favourites" onBack={jest.fn()} />));
        expect(await screen.findByText('@ana@art.social')).toBeTruthy();
        expect(screen.queryByLabelText(/Search/)).toBeNull();
    });

    it('says when the list is empty or hidden', async () => {
        api.get.mockResolvedValue({ data: [], headers: {} });
        await render(wrap(<Reactions id="ana" kind="following" onBack={jest.fn()} />));

        expect(screen.getByRole('header', { name: 'Following' })).toBeTruthy();
        expect(await screen.findByText(/Some people hide who they follow/)).toBeTruthy();
    });

    it('says when nobody has yet', async () => {
        api.get.mockResolvedValue({ data: [], headers: {} });
        await render(wrap(<Reactions id="p1" kind="boosts" onBack={jest.fn()} />));

        expect(screen.getByRole('header', { name: 'Boosted by' })).toBeTruthy();
        expect(await screen.findByText('Nobody yet.')).toBeTruthy();
    });
});
