import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils/queryClient';
import apiClient from '../services/api/client';
import { getReactions } from '../services/mastodon/statuses';
import { MediaViewerProvider } from '../components/MediaViewer/mediaViewer';
import Reactions from '../screens/Reactions/reactions';
import Thread from '../screens/Thread/thread';
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

    it('keeps the links without numbers when numbers are hidden', async () => {
        mockSettings.hideCounts = true;
        await renderThread(post({ favourites_count: 3, reblogs_count: 1, quotes_count: 2 }));

        expect(await screen.findByRole('button', { name: 'Favourites' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Boosts' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Quotes' })).toBeTruthy();
        expect(screen.queryByText('3 favourites')).toBeNull();
    });
});

describe('Reactions', () => {
    it('lists the people, with a follow button for everyone but you', async () => {
        api.get.mockImplementation(async (url: string) => {
            if (url === '/statuses/p1/favourited_by') return { data: [ana, me], headers: {} };
            if (url === '/accounts/relationships') return { data: [{ id: 'ana', following: false, requested: false, followed_by: false }] };
            return { data: [], headers: {} };
        });
        await render(wrap(<Reactions statusId="p1" reaction="favourites" onBack={jest.fn()} />));

        expect(screen.getByRole('header', { name: 'Favourited by' })).toBeTruthy();
        expect(await screen.findByText('@ana@art.social')).toBeTruthy();
        expect(screen.getByText('@me')).toBeTruthy();
        expect(screen.getAllByRole('button', { name: /Follow/ })).toHaveLength(1);
    });

    it('says when nobody has yet', async () => {
        api.get.mockResolvedValue({ data: [], headers: {} });
        await render(wrap(<Reactions statusId="p1" reaction="boosts" onBack={jest.fn()} />));

        expect(screen.getByRole('header', { name: 'Boosted by' })).toBeTruthy();
        expect(await screen.findByText('Nobody yet.')).toBeTruthy();
    });
});
