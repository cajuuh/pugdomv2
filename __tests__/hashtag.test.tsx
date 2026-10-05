import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils/queryClient';
import apiClient from '../services/api/client';
import Hashtag from '../screens/Hashtag/hashtag';
import { useOpenAccount } from '../hooks/useOpenAccount';
import { NavigationProvider, useNavigator } from '../services/navigationContext';
import { getTagTimeline, followTag, tagFromHref, unfollowTag, weeklyUsage } from '../services/mastodon/tags';
import { Status } from '../services/mastodon/types';

jest.mock('../services/api/client', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
// Pinned feeds are kept per account
jest.mock('../services/authContext', () => ({ useAuth: () => ({ user: { id: 'me' } }), useOptionalAuth: () => ({ user: { id: 'me' } }) }));
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
const post = apiClient.post as jest.Mock;
const day = (uses: number, accounts: number) => ({ day: '1759449600', uses: String(uses), accounts: String(accounts) });
const tagInfo = (following = false) => ({
    name: 'PugsOfMastodon',
    url: 'https://pug.social/tags/pugsofmastodon',
    following,
    history: [day(5, 3), day(4, 2), day(0, 0), day(3, 1), day(0, 0), day(0, 0), day(0, 0), day(9, 9)],
});

// GET /tags/:name → the tag; GET /timelines/tag/:tag → posts
const serve = (info = tagInfo(), posts: Partial<Status>[] = [{ id: 's1', content: 'pug post' }]) =>
    get.mockImplementation(async (url: string) => ({ data: url.startsWith('/tags/') ? info : posts }));

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('tags service', () => {
    it('asks for a hashtag timeline, with extra tags for multi-hashtag feeds', async () => {
        get.mockResolvedValue({ data: [] });

        await getTagTimeline('café', '99', { any: ['coffee'], none: ['tea'] });

        expect(get).toHaveBeenCalledWith('/timelines/tag/caf%C3%A9', { params: { max_id: '99', any: ['coffee'], none: ['tea'] } });
    });

    it('follows and unfollows by name', async () => {
        post.mockResolvedValue({ data: tagInfo(true) });

        await followTag('pugs');
        await unfollowTag('pugs');

        expect(post).toHaveBeenNthCalledWith(1, '/tags/pugs/follow');
        expect(post).toHaveBeenNthCalledWith(2, '/tags/pugs/unfollow');
    });

    it('adds up the last seven days of use', () => {
        expect(weeklyUsage(tagInfo())).toEqual({ posts: 12, people: 6 });
        expect(weeklyUsage(undefined)).toEqual({ posts: 0, people: 0 });
    });

    it('reads the tag from a hashtag link', () => {
        expect(tagFromHref('https://pug.social/tags/caf%C3%A9')).toBe('café');
        expect(tagFromHref('https://pug.social/tags/pugs/')).toBe('pugs');
        expect(tagFromHref('https://other.social/tags/Pugs?foo=1')).toBe('Pugs');
    });
});

describe('Hashtag screen', () => {
    const renderHashtag = (onBack = jest.fn()) =>
        render(
            <QueryClientProvider client={createTestQueryClient()}>
                <Hashtag tag="pugsofmastodon" onBack={onBack} onStatusPress={jest.fn()} />
            </QueryClientProvider>
        );

    it("shows the tag as the server spells it, this week's activity and its posts", async () => {
        serve();
        await renderHashtag();

        expect(await screen.findByRole('header', { name: '#PugsOfMastodon' })).toBeTruthy();
        expect(screen.getByText('12 posts by 6 people this week')).toBeTruthy();
        expect(await screen.findByText('pug post')).toBeTruthy();
        expect(get).toHaveBeenCalledWith('/timelines/tag/pugsofmastodon', { params: { max_id: undefined } });
    });

    it('follows the hashtag', async () => {
        serve();
        post.mockResolvedValue({ data: tagInfo(true) });
        await renderHashtag();

        await fireEvent.press(await screen.findByRole('button', { name: 'Follow hashtag' }));

        expect(post).toHaveBeenCalledWith('/tags/pugsofmastodon/follow');
        expect(await screen.findByRole('button', { name: 'Following' })).toBeTruthy();
    });

    it('asks before unfollowing', async () => {
        serve(tagInfo(true));
        post.mockResolvedValue({ data: tagInfo(false) });
        await renderHashtag();

        await fireEvent.press(await screen.findByRole('button', { name: 'Following' }));
        const [title, , buttons] = (Alert.alert as jest.Mock).mock.calls[0];
        expect(title).toBe('Unfollow #PugsOfMastodon?');
        await act(async () => {
            buttons.find((b: any) => b.style === 'destructive').onPress();
        });

        expect(post).toHaveBeenCalledWith('/tags/pugsofmastodon/unfollow');
        await waitFor(() => expect(screen.getByRole('button', { name: 'Follow hashtag' })).toBeTruthy());
    });

    it('undoes the follow and says so when it fails', async () => {
        serve();
        post.mockRejectedValue(new Error('network'));
        await renderHashtag();

        await fireEvent.press(await screen.findByRole('button', { name: 'Follow hashtag' }));

        expect(Alert.alert).toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Follow hashtag' })).toBeTruthy();
    });

    it('says when a hashtag is quiet and has no posts', async () => {
        serve({ ...tagInfo(), history: [day(0, 0)] }, []);
        await renderHashtag();

        expect(await screen.findByText('No posts this week')).toBeTruthy();
        expect(await screen.findByText('No posts with #PugsOfMastodon yet')).toBeTruthy();
    });

    it('goes back', async () => {
        serve();
        const onBack = jest.fn();
        await renderHashtag(onBack);

        await fireEvent.press(screen.getByRole('button', { name: 'Go back' }));

        expect(onBack).toHaveBeenCalled();
    });
});

describe('opening hashtags', () => {
    it('opens a hashtag on top of the current screen', async () => {
        const { result } = await renderHook(() => ({ open: useOpenAccount(), nav: useNavigator() }), {
            wrapper: ({ children }) => <NavigationProvider>{children}</NavigationProvider>,
        });

        await act(async () => result.current.open.openHashtag('Pugs'));
        // The same tag in another case is the same screen
        await act(async () => result.current.open.openHashtag('pugs'));

        expect(result.current.nav.stack.map(entry => entry.route)).toEqual([{ name: 'hashtag', tag: 'Pugs' }]);
    });
});

describe('linkKind', () => {
    const { linkKind } = jest.requireActual('../components/TootCard/htmlContent');

    it('treats Mastodon hashtag links (class "mention hashtag") as hashtags, not mentions', () => {
        expect(linkKind('https://pug.social/tags/anime', { class: 'mention hashtag', rel: 'tag' })).toBe('hashtag');
    });

    it('recognises hashtags by rel="tag" or a /tags/ path', () => {
        expect(linkKind('https://misskey.example/whatever', { rel: 'tag' })).toBe('hashtag');
        expect(linkKind('https://other.social/tags/Pugs', {})).toBe('hashtag');
    });

    it('keeps mentions and plain links apart', () => {
        expect(linkKind('https://art.social/@ana', { class: 'u-url mention' })).toBe('mention');
        expect(linkKind('https://example.com/tags-and-more', {})).toBe('link');
        expect(linkKind('https://example.com/blog/tags/', {})).toBe('link');
    });
});
