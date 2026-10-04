import React from 'react';
import { DeviceEventEmitter, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils/queryClient';
import apiClient from '../services/api/client';
import { fetchFeedPage } from '../services/mastodon/feedService';
import {
    createCustomHashtagFeed,
    createHashtagFeed,
    DEFAULT_PINNED_FEEDS,
    describeCriteria,
    feedLabel,
    TRENDING_FEED,
} from '../services/mastodon/feedTypes';
import { deleteCustomFeed, getCustomFeeds, getPinnedFeeds, getPinnedStorageKey, pinFeed, saveCustomFeed, unpinFeed } from '../services/pinnedFeeds';
import { createTranslator } from '../services/i18n/translate';
import { FeedsSheet } from '../components/FeedsSheet/feedsSheet';
import FeedEditor, { FEED_CREATED_EVENT, parseTags } from '../screens/FeedEditor/feedEditor';
import Timeline from '../screens/Timeline/timeline';
import { NavigationProvider, useNavigator } from '../services/navigationContext';
import { Status } from '../services/mastodon/types';

jest.mock('../services/api/client', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
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
const en = createTranslator('en');
const post = (id: string) => ({ id, content: `post ${id}` });

// Every request answers with a page named after its path, so tests can tell feeds apart
const serve = (followedTags: { name: string }[] = []) =>
    get.mockImplementation(async (url: string) => {
        if (url === '/followed_tags') return { data: followedTags };
        return { data: [post(url)] };
    });

const withQuery = (children: React.ReactNode) => (
    <QueryClientProvider client={createTestQueryClient()}>
        <NavigationProvider>{children}</NavigationProvider>
    </QueryClientProvider>
);

beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    serve();
});

describe('feed pages', () => {
    it('asks the right timeline for each kind of feed', async () => {
        await fetchFeedPage({ id: 'home', kind: 'home' });
        await fetchFeedPage({ id: 'local', kind: 'local' }, '9');
        await fetchFeedPage(TRENDING_FEED);
        await fetchFeedPage(createCustomHashtagFeed('Pets', '#Cats', ['pets'], [], ['dogs']));

        expect(get).toHaveBeenNthCalledWith(1, '/timelines/home', { params: { max_id: undefined } });
        expect(get).toHaveBeenNthCalledWith(2, '/timelines/public', { params: { max_id: '9', local: true } });
        expect(get.mock.calls[2][0]).toBe('/trends/statuses');
        expect(get).toHaveBeenNthCalledWith(4, '/timelines/tag/cats', { params: { max_id: undefined, any: ['pets'], all: undefined, none: ['dogs'] } });
    });
});

describe('feed descriptions', () => {
    it('names feeds in the user language', () => {
        expect(feedLabel(DEFAULT_PINNED_FEEDS[0], en)).toBe('Home');
        expect(feedLabel(TRENDING_FEED, createTranslator('pt-BR'))).toBe('Em alta');
        expect(feedLabel(createHashtagFeed('#Pugs'), en)).toBe('#pugs');
        expect(feedLabel(createCustomHashtagFeed('Pets', 'cats'), en)).toBe('Pets');
    });

    it('says what a hashtag feed shows', () => {
        expect(describeCriteria({ tag: 'cats', any: ['pets'], none: ['dogs'] })).toBe('#cats + #pets − #dogs');
        expect(describeCriteria({ tag: 'pugs' })).toBe('#pugs');
    });

    it('reads tags typed with or without #, commas or spaces', () => {
        expect(parseTags('#Cats, pets  #cats\n#dogs')).toEqual(['cats', 'pets', 'dogs']);
        expect(parseTags('  ')).toEqual([]);
    });
});

describe('pinned feeds storage', () => {
    it('starts with Home, Local and Federated, per account', async () => {
        expect(await getPinnedFeeds('me')).toEqual(DEFAULT_PINNED_FEEDS);
        expect(getPinnedStorageKey('me')).not.toBe(getPinnedStorageKey('other'));
    });

    it('pins once, keeps Home and never unpins it', async () => {
        await pinFeed('me', TRENDING_FEED);
        await pinFeed('me', TRENDING_FEED);
        expect((await getPinnedFeeds('me')).map(feed => feed.id)).toEqual(['home', 'local', 'federated', 'trending']);

        await unpinFeed('me', 'home');
        await unpinFeed('me', 'local');
        expect((await getPinnedFeeds('me')).map(feed => feed.id)).toEqual(['home', 'federated', 'trending']);
    });

    it('unpins a hashtag feed when it is deleted', async () => {
        const pets = createCustomHashtagFeed('Pets', 'cats');
        await saveCustomFeed('me', pets);
        await pinFeed('me', pets);

        await deleteCustomFeed('me', pets.id);

        expect(await getCustomFeeds('me')).toEqual([]);
        expect((await getPinnedFeeds('me')).some(feed => feed.id === pets.id)).toBe(false);
    });
});

describe('Feeds sheet', () => {
    const renderSheet = (props: Partial<React.ComponentProps<typeof FeedsSheet>> = {}) =>
        render(withQuery(<FeedsSheet visible onClose={jest.fn()} onSelectFeed={jest.fn()} onCreateFeed={jest.fn()} {...props} />));

    it('lists pinned feeds, trending and followed hashtags', async () => {
        serve([{ name: 'pugs' }]);
        await renderSheet();

        expect(screen.getByRole('button', { name: 'Open Home' })).toBeTruthy();
        expect(screen.getByText('Always here')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Open Trending' })).toBeTruthy();
        expect(await screen.findByRole('button', { name: 'Open #pugs' })).toBeTruthy();
    });

    it('pins a feed', async () => {
        await renderSheet();

        await fireEvent.press(screen.getAllByRole('button', { name: 'Pin' })[0]);

        await waitFor(async () => expect((await getPinnedFeeds('me')).map(feed => feed.id)).toContain('trending'));
    });

    it('opens a feed and closes', async () => {
        const onSelectFeed = jest.fn();
        const onClose = jest.fn();
        await renderSheet({ onSelectFeed, onClose });

        await fireEvent.press(screen.getByRole('button', { name: 'Open Trending' }));

        expect(onSelectFeed).toHaveBeenCalledWith(TRENDING_FEED);
        expect(onClose).toHaveBeenCalled();
    });

    it('starts a new hashtag feed', async () => {
        const onCreateFeed = jest.fn();
        await renderSheet({ onCreateFeed });

        await fireEvent.press(screen.getByRole('button', { name: /New hashtag feed/ }));

        expect(onCreateFeed).toHaveBeenCalled();
    });
});

describe('Feed editor', () => {
    it('saves and pins a hashtag feed, then opens it', async () => {
        const created = jest.fn();
        const subscription = DeviceEventEmitter.addListener(FEED_CREATED_EVENT, created);
        const onBack = jest.fn();
        await render(withQuery(<FeedEditor onBack={onBack} />));

        await fireEvent.changeText(screen.getByLabelText('Hashtags'), '#cats pets');
        await fireEvent.changeText(screen.getByLabelText('Leave out'), '#dogs');
        expect(screen.getByText('#cats + #pets − #dogs')).toBeTruthy();
        await fireEvent.press(screen.getByRole('button', { name: 'Save and pin' }));

        await waitFor(() => expect(onBack).toHaveBeenCalled());
        const [feed] = await getCustomFeeds('me');
        expect(feed).toMatchObject({ kind: 'hashtag', title: '#cats', criteria: { tag: 'cats', any: ['pets'], none: ['dogs'] } });
        expect((await getPinnedFeeds('me')).some(pinned => pinned.id === feed.id)).toBe(true);
        expect(created).toHaveBeenCalledWith(expect.objectContaining({ id: feed.id }));
        subscription.remove();
    });

    it('needs at least one hashtag', async () => {
        await render(withQuery(<FeedEditor onBack={jest.fn()} />));
        expect(screen.getByRole('button', { name: 'Save and pin' })).toBeDisabled();
    });
});

describe('Timeline feed pills', () => {
    it('shows the pinned feeds and switches between them', async () => {
        await pinFeed('me', createHashtagFeed('pugs'));
        await render(withQuery(<Timeline />));

        expect(await screen.findByRole('tab', { name: '#pugs' })).toBeTruthy();
        expect(screen.getByRole('tab', { name: 'Home' })).toBeSelected();
        expect(await screen.findByText('post /timelines/home')).toBeTruthy();

        await fireEvent.press(screen.getByRole('tab', { name: '#pugs' }));

        expect(await screen.findByText('post /timelines/tag/pugs')).toBeTruthy();
        expect(screen.getByRole('tab', { name: '#pugs' })).toBeSelected();
    });

    it('opens the feed editor from the sheet', async () => {
        const StackProbe = () => <Text testID="stack">{JSON.stringify(useNavigator().stack.map(entry => entry.route))}</Text>;
        await render(withQuery(<><Timeline /><StackProbe /></>));

        await fireEvent.press(await screen.findByRole('button', { name: 'Feeds' }));
        await fireEvent.press(screen.getByRole('button', { name: /New hashtag feed/ }));

        expect(JSON.parse(screen.getByTestId('stack').props.children)).toEqual([{ name: 'feedEditor' }]);
    });

    it('switches to a feed made in the editor', async () => {
        // The editor saves and pins it before announcing it
        const pets = createCustomHashtagFeed('Pets', 'cats');
        await pinFeed('me', pets);
        await render(withQuery(<Timeline />));
        await screen.findByText('post /timelines/home');

        await act(async () => {
            DeviceEventEmitter.emit(FEED_CREATED_EVENT, pets);
        });

        expect(await screen.findByText('post /timelines/tag/cats')).toBeTruthy();
    });
});
