import React from 'react';
import { DeviceEventEmitter, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
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
import { deleteCustomFeed, getCustomFeeds, getPinnedFeeds, getPinnedStorageKey, pinFeed, replaceCustomFeed, saveCustomFeed, unpinFeed } from '../services/pinnedFeeds';
import { createTranslator } from '../services/i18n/translate';
import { FeedsSheet } from '../components/FeedsSheet/feedsSheet';
import { dropIndex, slotOffset } from '../components/FeedsSheet/pinnedRows';
import FeedEditor, { FEED_CREATED_EVENT, parseTags } from '../screens/FeedEditor/feedEditor';
import Timeline from '../screens/Timeline/timeline';
import { NavigationProvider, useNavigator } from '../services/navigationContext';
import { Status } from '../services/mastodon/types';

jest.mock('../services/api/client', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
jest.mock('../services/authContext', () => ({ useAuth: () => ({ user: { id: 'me' } }), useOptionalAuth: () => ({ user: { id: 'me' } }) }));
jest.mock('../services/themeContext', () => ({
    useTheme: () => jest.requireActual('../testUtils/theme').mockTheme,
}));
const mockSettings = { swipeFeeds: false, homeBoosts: true, homeReplies: true };
jest.mock('../services/settingsContext', () => ({ ...jest.requireActual('../services/settingsContext'), useSettings: () => mockSettings }));
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
    mockSettings.swipeFeeds = false;
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

    it('puts an edited feed in the old one\'s place', async () => {
        const pets = createCustomHashtagFeed('Pets', 'cats');
        const birds = createCustomHashtagFeed('Birds', 'owls');
        const edited = createCustomHashtagFeed('Animals', 'dogs');
        await saveCustomFeed('me', pets);
        await saveCustomFeed('me', birds);
        await pinFeed('me', pets);
        await pinFeed('me', TRENDING_FEED);

        await replaceCustomFeed('me', pets.id, edited);

        expect((await getCustomFeeds('me')).map(feed => feed.id)).toEqual([edited.id, birds.id]);
        expect((await getPinnedFeeds('me')).map(feed => feed.id)).toEqual(['home', 'local', 'federated', edited.id, 'trending']);
    });

    it('keeps an unpinned feed unpinned when it is edited', async () => {
        const pets = createCustomHashtagFeed('Pets', 'cats');
        const edited = createCustomHashtagFeed('Animals', 'dogs');
        await saveCustomFeed('me', pets);

        await replaceCustomFeed('me', pets.id, edited);

        expect((await getPinnedFeeds('me')).some(feed => feed.id === edited.id)).toBe(false);
    });
});

describe('Feeds sheet', () => {
    const renderSheet = (props: Partial<React.ComponentProps<typeof FeedsSheet>> = {}) =>
        render(withQuery(<FeedsSheet visible onClose={jest.fn()} onSelectFeed={jest.fn()} onEditFeed={jest.fn()} onEditList={jest.fn()} onAddServer={jest.fn()} {...props} />));

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
        const onEditFeed = jest.fn();
        await renderSheet({ onEditFeed });

        await fireEvent.press(screen.getByRole('button', { name: /New hashtag feed/ }));

        expect(onEditFeed).toHaveBeenCalledWith(undefined);
    });

    it('edits one of your hashtag feeds', async () => {
        const pets = createCustomHashtagFeed('Pets', 'cats');
        await saveCustomFeed('me', pets);
        const onEditFeed = jest.fn();
        const onClose = jest.fn();
        await renderSheet({ onEditFeed, onClose });

        await fireEvent.press(await screen.findByRole('button', { name: 'Edit Pets' }));

        expect(onEditFeed).toHaveBeenCalledWith(pets);
        expect(onClose).toHaveBeenCalled();
    });

    describe('rearranging pinned feeds', () => {
        const pinnedIds = async () => (await getPinnedFeeds('me')).map(feed => feed.id);
        const drag = (id: string, translationY: number, last: State = State.END) =>
            act(async () => {
                fireGestureHandler(getByGestureTestId(`drag-${id}`), [
                    { state: State.BEGAN, translationY: 0 },
                    { state: State.ACTIVE, translationY: 0 },
                    { state: State.ACTIVE, translationY },
                    { state: last, translationY },
                ]);
            });
        // Once the sheet's queries settle: Reanimated's mock makes new shared values on every render
        const measureRows = async () => {
            await act(async () => {
                await new Promise(resolve => setTimeout(resolve, 0));
            });
            for (const name of ['Home', 'Local', 'Federated']) {
                await fireEvent(screen.getByRole('button', { name: `Open ${name}` }), 'layout', { nativeEvent: { layout: { height: 60 } } });
            }
        };

        it('moves a feed with the arrows, one tap after another', async () => {
            await renderSheet();

            await fireEvent.press(screen.getByRole('button', { name: 'Move Federated up' }));
            await fireEvent.press(screen.getByRole('button', { name: 'Move Federated up' }));

            await waitFor(async () => expect(await pinnedIds()).toEqual(['federated', 'home', 'local']));
        });

        it('has nowhere to go past either end', async () => {
            await renderSheet();

            expect(screen.getByRole('button', { name: 'Move Home up' })).toBeDisabled();
            expect(screen.getByRole('button', { name: 'Move Federated down' })).toBeDisabled();
        });

        it('moves a feed held and dragged', async () => {
            await renderSheet();
            await measureRows();

            await drag('home', 100);

            await waitFor(async () => expect(await pinnedIds()).toEqual(['local', 'federated', 'home']));
        });

        it('keeps the order after a short or cancelled drag', async () => {
            await renderSheet();
            await measureRows();

            await drag('home', 20);
            await drag('home', 100, State.CANCELLED);

            expect(await pinnedIds()).toEqual(['home', 'local', 'federated']);
        });

        it('works out where a dragged row lands', () => {
            const heights = [60, 60, 80];
            expect(dropIndex(heights, 0, 20)).toBe(0);
            expect(dropIndex(heights, 0, 31)).toBe(1);
            expect(dropIndex(heights, 0, 100)).toBe(1);
            expect(dropIndex(heights, 0, 101)).toBe(2);
            expect(dropIndex(heights, 0, 900)).toBe(2);
            expect(dropIndex(heights, 2, -31)).toBe(1);
            expect(dropIndex(heights, 1, -900)).toBe(0);
            expect(slotOffset(heights, 0, 2)).toBe(140);
            expect(slotOffset(heights, 2, 0)).toBe(-120);
            expect(slotOffset(heights, 1, 1)).toBe(0);
        });

        it('falls back to Home, not the first pill, when the open feed is unpinned', async () => {
            await pinFeed('me', TRENDING_FEED);
            await render(withQuery(<Timeline />));
            await fireEvent.press(await screen.findByRole('tab', { name: 'Trending' }));
            await fireEvent.press(screen.getByRole('button', { name: 'Feeds' }));
            await fireEvent.press(screen.getByRole('button', { name: 'Move Local up' }));
            await waitFor(async () => expect((await pinnedIds())[0]).toBe('local'));

            await fireEvent.press(screen.getAllByRole('button', { name: 'Pinned' }).slice(-1)[0]);

            await waitFor(() => expect(screen.getByRole('tab', { name: 'Home' })).toBeSelected());
        });
    });

    describe('unfollowing a hashtag', () => {
        const post = apiClient.post as jest.Mock;
        const pressUnfollow = async () => {
            await fireEvent.press(await screen.findByRole('button', { name: 'Unfollow #pugs' }));
            expect(post).not.toHaveBeenCalled();
            await fireEvent.press(await screen.findByRole('button', { name: 'Unfollow' }));
        };

        it('asks first, then unfollows and drops the row', async () => {
            serve([{ name: 'pugs' }]);
            post.mockResolvedValue({ data: { name: 'pugs', following: false } });
            await renderSheet();

            await pressUnfollow();

            await waitFor(() => expect(post).toHaveBeenCalledWith('/tags/pugs/unfollow'));
            await waitFor(() => expect(screen.queryByRole('button', { name: 'Open #pugs' })).toBeNull());
        });

        it('keeps a pinned hashtag pinned', async () => {
            serve([{ name: 'pugs' }]);
            await pinFeed('me', createHashtagFeed('pugs'));
            post.mockResolvedValue({ data: { name: 'pugs', following: false } });
            await renderSheet();
            await screen.findAllByRole('button', { name: 'Open #pugs' });

            await pressUnfollow();

            await waitFor(() => expect(screen.getAllByRole('button', { name: 'Open #pugs' })).toHaveLength(1));
            expect((await getPinnedFeeds('me')).some(feed => feed.id === 'tag:pugs')).toBe(true);
        });

        it('keeps the row when the request fails', async () => {
            serve([{ name: 'pugs' }]);
            post.mockRejectedValue(new Error('offline'));
            await renderSheet();

            await pressUnfollow();

            expect(await screen.findByText("Couldn't update this hashtag. Please try again.")).toBeTruthy();
            expect(screen.getByRole('button', { name: 'Open #pugs' })).toBeTruthy();
        });
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

    it('changes a feed\'s name and hashtags', async () => {
        const pets = createCustomHashtagFeed('Pets', 'cats', ['pugs'], [], ['dogs']);
        await saveCustomFeed('me', pets);
        const created = jest.fn();
        const subscription = DeviceEventEmitter.addListener(FEED_CREATED_EVENT, created);
        const onBack = jest.fn();
        await render(withQuery(<FeedEditor feed={pets} onBack={onBack} />));

        expect(screen.getByLabelText('Hashtags').props.value).toBe('#cats #pugs');
        expect(screen.getByLabelText('Leave out').props.value).toBe('#dogs');
        expect(screen.getByLabelText('Name (optional)').props.value).toBe('Pets');

        await fireEvent.changeText(screen.getByLabelText('Hashtags'), '#cats #birds');
        await fireEvent.changeText(screen.getByLabelText('Name (optional)'), 'Animals');
        await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(onBack).toHaveBeenCalled());
        const feeds = await getCustomFeeds('me');
        expect(feeds).toHaveLength(1);
        expect(feeds[0]).toMatchObject({ title: 'Animals', criteria: { tag: 'cats', any: ['birds'], none: ['dogs'] } });
        expect(created).toHaveBeenCalledWith(expect.objectContaining({ title: 'Animals' }));
        subscription.remove();
    });

    it('lets an unnamed feed follow its first hashtag', async () => {
        const unnamed = createCustomHashtagFeed('', 'cats');
        await saveCustomFeed('me', unnamed);
        const onBack = jest.fn();
        await render(withQuery(<FeedEditor feed={unnamed} onBack={onBack} />));
        expect(screen.getByLabelText('Name (optional)').props.value).toBe('');

        await fireEvent.changeText(screen.getByLabelText('Hashtags'), 'dogs');
        await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(onBack).toHaveBeenCalled());
        expect((await getCustomFeeds('me'))[0].title).toBe('#dogs');
    });

    it('can\'t save a feed left with no hashtags', async () => {
        const pets = createCustomHashtagFeed('Pets', 'cats');
        await render(withQuery(<FeedEditor feed={pets} onBack={jest.fn()} />));

        await fireEvent.changeText(screen.getByLabelText('Hashtags'), ' ');

        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
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

    it('previews a feed from the sheet without pinning it, then pins it', async () => {
        await render(withQuery(<Timeline />));
        await screen.findByText('post /timelines/home');

        await fireEvent.press(screen.getByRole('button', { name: 'Feeds' }));
        await fireEvent.press(screen.getByRole('button', { name: 'Open Trending' }));

        expect(await screen.findByText('post /trends/statuses')).toBeTruthy();
        expect(screen.getByRole('tab', { name: 'Trending' })).toBeSelected();
        expect((await getPinnedFeeds('me')).some(feed => feed.id === 'trending')).toBe(false);

        await fireEvent.press(screen.getByRole('button', { name: 'Pin Trending' }));

        // Once pinned it's a regular pill, still open
        await waitFor(() => expect(screen.queryByRole('button', { name: 'Pin Trending' })).toBeNull());
        expect(screen.getByRole('tab', { name: 'Trending' })).toBeSelected();
        expect((await getPinnedFeeds('me')).some(feed => feed.id === 'trending')).toBe(true);
    });

    it('drops the preview when switching to a pinned feed', async () => {
        await render(withQuery(<Timeline />));
        await screen.findByText('post /timelines/home');
        await fireEvent.press(screen.getByRole('button', { name: 'Feeds' }));
        await fireEvent.press(screen.getByRole('button', { name: 'Open Trending' }));
        await screen.findByText('post /trends/statuses');

        await fireEvent.press(screen.getByRole('tab', { name: 'Local' }));

        expect(screen.queryByRole('tab', { name: 'Trending' })).toBeNull();
        expect(screen.getByRole('tab', { name: 'Local' })).toBeSelected();
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

    it('shows the new hashtags\' posts after editing the open feed', async () => {
        const pets = createCustomHashtagFeed('Pets', 'cats');
        await saveCustomFeed('me', pets);
        await pinFeed('me', pets);
        await render(withQuery(<><Timeline /><FeedEditor feed={pets} onBack={jest.fn()} /></>));
        await fireEvent.press(await screen.findByRole('tab', { name: 'Pets' }));
        expect(await screen.findByText('post /timelines/tag/cats')).toBeTruthy();

        await fireEvent.changeText(screen.getByLabelText('Hashtags'), 'dogs');
        await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

        expect(await screen.findByText('post /timelines/tag/dogs')).toBeTruthy();
        expect(screen.queryByText('post /timelines/tag/cats')).toBeNull();
        expect(screen.getByRole('tab', { name: 'Pets' })).toBeSelected();
    });
});

describe('Swiping between feeds', () => {
    const swipe = (translationX: number, last: State = State.END) =>
        act(async () => {
            fireGestureHandler(getByGestureTestId('swipe-feeds'), [
                { state: State.BEGAN, translationX: 0 },
                { state: State.ACTIVE, translationX },
                { state: last, translationX },
            ]);
        });
    const renderTimeline = async () => {
        await render(withQuery(<Timeline />));
        await screen.findByText('post /timelines/home');
    };

    it('moves through the pinned feeds and stops at the ends', async () => {
        mockSettings.swipeFeeds = true;
        await renderTimeline();

        await swipe(100);
        expect(screen.getByRole('tab', { name: 'Home' })).toBeSelected();

        await swipe(-100);
        expect(screen.getByRole('tab', { name: 'Local' })).toBeSelected();
        await swipe(-100);
        expect(screen.getByRole('tab', { name: 'Federated' })).toBeSelected();
        await swipe(-100);
        expect(screen.getByRole('tab', { name: 'Federated' })).toBeSelected();

        await swipe(100);
        expect(screen.getByRole('tab', { name: 'Local' })).toBeSelected();
    });

    it('ignores a short or cancelled drag', async () => {
        mockSettings.swipeFeeds = true;
        await renderTimeline();

        await swipe(-40);
        await swipe(-100, State.FAILED);

        expect(screen.getByRole('tab', { name: 'Home' })).toBeSelected();
    });

    it('goes from a preview to the first pinned feed', async () => {
        mockSettings.swipeFeeds = true;
        await renderTimeline();
        await fireEvent.press(screen.getByRole('button', { name: 'Feeds' }));
        await fireEvent.press(screen.getByRole('button', { name: 'Open Trending' }));
        await screen.findByText('post /trends/statuses');

        await swipe(100);
        expect(screen.getByRole('tab', { name: 'Trending' })).toBeSelected();

        await swipe(-100);
        expect(screen.queryByRole('tab', { name: 'Trending' })).toBeNull();
        expect(screen.getByRole('tab', { name: 'Home' })).toBeSelected();
    });

    it('does nothing with the setting off', async () => {
        await renderTimeline();

        expect(getByGestureTestId('swipe-feeds').config.enabled).toBe(false);
    });

    it('is off until switched on, and remembers', async () => {
        const { SettingsProvider, useSettings: useRealSettings } = jest.requireActual('../services/settingsContext');
        const settings: { current?: { swipeFeeds: boolean; setSwipeFeeds: (value: boolean) => Promise<void>; loadingSettings: boolean } } = {};
        const Probe = () => {
            settings.current = useRealSettings();
            return null;
        };
        const first = await render(<SettingsProvider><Probe /></SettingsProvider>);
        await waitFor(() => expect(settings.current?.loadingSettings).toBe(false));
        expect(settings.current?.swipeFeeds).toBe(false);

        await act(async () => {
            await settings.current?.setSwipeFeeds(true);
        });
        await first.unmount();

        await render(<SettingsProvider><Probe /></SettingsProvider>);
        await waitFor(() => expect(settings.current?.swipeFeeds).toBe(true));
    });
});
