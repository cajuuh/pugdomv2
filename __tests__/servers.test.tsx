import React from 'react';
import { DeviceEventEmitter, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils/queryClient';
import apiClient, { publicClient } from '../services/api/client';
import { checkServer, isDomain, normalizeDomain } from '../services/mastodon/servers';
import { fetchFeedPage, fetchFeedNewer } from '../services/mastodon/feedService';
import { createServerFeed, feedIcon, feedLabel } from '../services/mastodon/feedTypes';
import { getPinnedFeeds, pinFeed } from '../services/pinnedFeeds';
import { createTranslator } from '../services/i18n/translate';
import { resolveAccount, resolveStatus } from '../services/mastodon/search';
import ServerPicker from '../screens/ServerPicker/serverPicker';
import { FEED_CREATED_EVENT, FEED_OPEN_EVENT } from '../screens/FeedEditor/feedEditor';
import { FeedsSheet } from '../components/FeedsSheet/feedsSheet';
import { MediaViewerProvider } from '../components/MediaViewer/mediaViewer';
import { TootCard } from '../components/TootCard/tootCard';
import { NavigationProvider, useNavigator } from '../services/navigationContext';
import { Status } from '../services/mastodon/types';

jest.mock('../services/api/client', () => ({
    __esModule: true,
    default: { get: jest.fn(), post: jest.fn() },
    publicClient: { get: jest.fn() },
}));
jest.mock('../services/storage', () => ({
    getCredentials: async () => ({ accessToken: 'token', instanceUrl: 'https://home.social' }),
}));
jest.mock('../services/mastodon/search', () => ({
    ...jest.requireActual('../services/mastodon/search'),
    resolveStatus: jest.fn(),
    resolveAccount: jest.fn(),
}));
jest.mock('../services/authContext', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));
jest.mock('../services/themeContext', () => ({
    useTheme: () => jest.requireActual('../testUtils/theme').mockTheme,
}));
jest.mock('../services/settingsContext', () => ({
    useSettings: () => ({ compactMode: false, mediaAutoplay: false }),
}));
jest.mock('../services/composeContext', () => ({
    useCompose: () => ({ openCompose: jest.fn() }),
}));

const get = publicClient.get as jest.Mock;
const ownGet = apiClient.get as jest.Mock;
const instance = { title: 'Mastodon Art', description: 'A place for artists', thumbnail: { url: 'https://art.social/thumb.png' } };
const failure = (status?: number) => Object.assign(new Error('failed'), status ? { response: { status } } : {});

// The other server's answers: its instance info and its local timeline
const serve = ({ timeline = async () => ({ data: [] }) as unknown } = {}) =>
    get.mockImplementation(async (url: string) => {
        if (url.endsWith('/api/v2/instance')) return { data: instance };
        return timeline();
    });

const StackProbe = () => <Text testID="stack">{JSON.stringify(useNavigator().stack.map(entry => entry.route))}</Text>;
const stack = () => JSON.parse(screen.getByTestId('stack').props.children);

const withQuery = (children: React.ReactNode) => (
    <QueryClientProvider client={createTestQueryClient()}>
        <NavigationProvider>
            <MediaViewerProvider>
                {children}
                <StackProbe />
            </MediaViewerProvider>
        </NavigationProvider>
    </QueryClientProvider>
);

beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    serve();
    ownGet.mockResolvedValue({ data: [] });
});

describe('server addresses', () => {
    it('reads addresses typed in different ways', () => {
        expect(normalizeDomain(' https://Art.Social/about ')).toBe('art.social');
        expect(normalizeDomain('@art.social')).toBe('art.social');
        expect(isDomain('art.social')).toBe(true);
        expect(isDomain('art')).toBe(false);
        expect(isDomain('art social')).toBe(false);
    });
});

describe('checking a server', () => {
    it('reads its name and checks its timeline without our account', async () => {
        const result = await checkServer('Art.Social');

        expect(result).toEqual({
            ok: true,
            server: { domain: 'art.social', title: 'Mastodon Art', description: 'A place for artists', thumbnail: 'https://art.social/thumb.png' },
        });
        expect(get).toHaveBeenCalledWith('https://art.social/api/v1/timelines/public', {
            params: { local: true, max_id: undefined, since_id: undefined, limit: 1 },
        });
        expect(ownGet).not.toHaveBeenCalled();
    });

    it('says when a server only shows its timeline to its own people', async () => {
        serve({ timeline: () => Promise.reject(failure(422)) });
        expect(await checkServer('art.social')).toEqual({ ok: false, reason: 'private' });
    });

    it('says when a server cannot be reached', async () => {
        get.mockRejectedValue(failure());
        expect(await checkServer('nowhere.example')).toEqual({ ok: false, reason: 'unreachable' });
    });

    it('turns away bad addresses and our own server', async () => {
        expect(await checkServer('not a server')).toEqual({ ok: false, reason: 'invalid' });
        expect(await checkServer('home.social')).toEqual({ ok: false, reason: 'own' });
        expect(get).not.toHaveBeenCalled();
    });
});

describe('server feeds', () => {
    it("pages through the server's local timeline", async () => {
        const feed = createServerFeed({ domain: 'art.social', title: 'Mastodon Art' });
        await fetchFeedPage(feed, '9');
        await fetchFeedNewer(feed, '12');

        expect(feed).toMatchObject({ id: 'server:art.social', kind: 'server', title: 'Mastodon Art', domain: 'art.social' });
        expect(feedLabel(feed, createTranslator('en'))).toBe('Mastodon Art');
        expect(feedIcon('server')).toBe('planet-outline');
        expect(get.mock.calls[0]).toEqual(['https://art.social/api/v1/timelines/public', { params: expect.objectContaining({ local: true, max_id: '9' }) }]);
        expect(get.mock.calls[1]).toEqual(['https://art.social/api/v1/timelines/public', { params: expect.objectContaining({ local: true, since_id: '12' }) }]);
    });
});

describe('Server picker', () => {
    it('checks a server, then pins and opens its timeline', async () => {
        const created = jest.fn();
        const subscription = DeviceEventEmitter.addListener(FEED_CREATED_EVENT, created);
        const onBack = jest.fn();
        await render(withQuery(<ServerPicker onBack={onBack} />));

        expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
        await fireEvent.changeText(screen.getByLabelText('Server'), 'https://art.social');
        await fireEvent.press(screen.getByRole('button', { name: 'Check' }));
        expect(await screen.findByText('Mastodon Art')).toBeTruthy();
        expect(screen.getByText('A place for artists')).toBeTruthy();

        await fireEvent.press(screen.getByRole('button', { name: 'Pin its timeline' }));

        await waitFor(() => expect(onBack).toHaveBeenCalled());
        expect((await getPinnedFeeds('me')).some(feed => feed.id === 'server:art.social')).toBe(true);
        expect(created).toHaveBeenCalledWith(expect.objectContaining({ id: 'server:art.social' }));
        subscription.remove();
    });

    it('opens its timeline to look at, without pinning it', async () => {
        const opened = jest.fn();
        const subscription = DeviceEventEmitter.addListener(FEED_OPEN_EVENT, opened);
        const onBack = jest.fn();
        await render(withQuery(<ServerPicker onBack={onBack} />));

        await fireEvent.changeText(screen.getByLabelText('Server'), 'art.social');
        await fireEvent.press(screen.getByRole('button', { name: 'Check' }));
        await fireEvent.press(await screen.findByRole('button', { name: 'See timeline' }));

        expect(opened).toHaveBeenCalledWith(expect.objectContaining({ id: 'server:art.social', kind: 'server' }));
        expect(onBack).toHaveBeenCalled();
        expect((await getPinnedFeeds('me')).some(feed => feed.id === 'server:art.social')).toBe(false);
        subscription.remove();
    });

    it("explains why a server can't be pinned", async () => {
        serve({ timeline: () => Promise.reject(failure(401)) });
        await render(withQuery(<ServerPicker onBack={jest.fn()} />));

        await fireEvent.changeText(screen.getByLabelText('Server'), 'art.social');
        await fireEvent(screen.getByLabelText('Server'), 'submitEditing');

        expect(await screen.findByText('art.social only shows its timeline to people with an account there.')).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Pin its timeline' })).toBeNull();
    });
});

describe('Other servers in the Feeds sheet', () => {
    it('lists pinned servers and adds new ones', async () => {
        await pinFeed('me', createServerFeed({ domain: 'art.social', title: 'Mastodon Art' }));
        const onAddServer = jest.fn();
        await render(withQuery(
            <FeedsSheet visible onClose={jest.fn()} onSelectFeed={jest.fn()} onCreateFeed={jest.fn()} onEditList={jest.fn()} onAddServer={onAddServer} />
        ));

        expect(await screen.findAllByText('Local timeline of art.social')).toHaveLength(2);
        await fireEvent.press(screen.getByRole('button', { name: 'Add a server' }));

        expect(onAddServer).toHaveBeenCalled();
    });
});

describe('Posts from another server', () => {
    const remotePost: Status = {
        id: '111',
        created_at: new Date().toISOString(),
        in_reply_to_id: null,
        in_reply_to_account_id: null,
        sensitive: false,
        spoiler_text: '',
        visibility: 'public',
        language: 'en',
        uri: 'https://art.social/users/ana/statuses/111',
        url: 'https://art.social/@ana/111',
        replies_count: 1,
        reblogs_count: 2,
        favourites_count: 3,
        content: '<p>remote post</p>',
        reblog: null,
        account: { id: 'remote-ana', username: 'ana', acct: 'ana', display_name: 'Ana', avatar: '', emojis: [], url: 'https://art.social/@ana' },
        media_attachments: [],
        emojis: [],
    };

    it('has no buttons that act on it, only one that opens it through our server', async () => {
        (resolveStatus as jest.Mock).mockResolvedValue({ ...remotePost, id: 'ours-1' });
        await render(withQuery(<TootCard status={remotePost} remote />));

        expect(screen.queryByRole('button', { name: /boost/i })).toBeNull();
        expect(screen.queryByRole('button', { name: /favourite/i })).toBeNull();
        await fireEvent.press(screen.getByRole('button', { name: 'Open to interact' }));

        expect(resolveStatus).toHaveBeenCalledWith('https://art.social/@ana/111');
        expect(stack()).toEqual([{ name: 'thread', statusId: 'ours-1' }]);
    });

    it('finds its author through our server too', async () => {
        (resolveAccount as jest.Mock).mockResolvedValue({ ...remotePost.account, id: 'ours-ana' });
        await render(withQuery(<TootCard status={remotePost} remote />));

        await fireEvent.press(screen.getAllByRole('link', { name: /Ana/ })[0]);

        expect(resolveAccount).toHaveBeenCalledWith('https://art.social/@ana');
        expect(stack()[0]).toMatchObject({ name: 'account', accountId: 'ours-ana' });
    });
});
