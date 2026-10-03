import React from 'react';
import { Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils/queryClient';
import Setup, { runSetup, setupFraction, SetupProgress } from '../screens/Setup/setup';
import { en } from '../services/i18n/en';

const SETUP_MESSAGES = en.setup.messages;
import { emojiCacheKey, loadCachedEmojis, prefetchEmojiImages, saveCachedEmojis } from '../services/emojiCache';
import { CUSTOM_EMOJIS_KEY, EMOJI_STALE_TIME, useEmojiCachePrimer } from '../hooks/useCustomEmojis';
import { fetchCustomEmojis } from '../services/mastodon/customEmojis';
import { fetchInstanceConfiguration } from '../services/mastodon/instance';
import { CustomEmoji } from '../services/mastodon/types';

jest.mock('../services/themeContext', () => ({
    useTheme: () => jest.requireActual('../testUtils/theme').mockTheme,
}));
jest.mock('../services/storage', () => ({
    getCredentials: jest.fn(async () => ({ accessToken: 't', instanceUrl: 'https://pug.social' })),
}));
jest.mock('../services/mastodon/customEmojis', () => ({ fetchCustomEmojis: jest.fn() }));
jest.mock('../services/mastodon/instance', () => ({
    ...jest.requireActual('../services/mastodon/instance'),
    fetchInstanceConfiguration: jest.fn(),
}));

const mockedFetchEmojis = fetchCustomEmojis as jest.MockedFunction<typeof fetchCustomEmojis>;
const mockedInstance = fetchInstanceConfiguration as jest.MockedFunction<typeof fetchInstanceConfiguration>;

const emoji = (shortcode: string, visible = true): CustomEmoji => ({
    shortcode,
    url: `https://pug.social/${shortcode}.gif`,
    static_url: `https://pug.social/${shortcode}.png`,
    visible_in_picker: visible,
    category: 'Pugs',
});

let prefetch: jest.SpyInstance;

beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    prefetch = jest.spyOn(Image, 'prefetch').mockResolvedValue(true);
    mockedFetchEmojis.mockResolvedValue([emoji('pug'), emoji('blobcat'), emoji('hidden', false)]);
    mockedInstance.mockResolvedValue({ maxCharacters: 500, maxPollOptions: 4, maxCharactersPerPollOption: 50 });
});

afterEach(() => prefetch.mockRestore());

describe('emoji cache', () => {
    it('stores emoji per server, keeping only what the app uses', async () => {
        await saveCachedEmojis('https://Pug.Social/', [{ ...emoji('pug'), extra: 'x' } as CustomEmoji], 1000);

        expect(emojiCacheKey('https://Pug.Social/')).toBe(emojiCacheKey('pug.social'));
        expect(await loadCachedEmojis('pug.social')).toEqual({ emojis: [emoji('pug')], savedAt: 1000 });
        expect(await loadCachedEmojis('https://other.social')).toBeNull();
    });

    it('treats an unreadable entry as missing', async () => {
        await AsyncStorage.setItem(emojiCacheKey('https://pug.social'), '{not json');
        expect(await loadCachedEmojis('https://pug.social')).toBeNull();
    });

    it('downloads the picker images and reports progress, skipping failures', async () => {
        prefetch.mockImplementation(async (url: string) => {
            if (url.includes('blobcat')) throw new Error('404');
            return true;
        });
        const progress: [number, number][] = [];

        await prefetchEmojiImages([emoji('pug'), emoji('blobcat'), emoji('hidden', false)], (done, total) => progress.push([done, total]), 1);

        expect(prefetch.mock.calls.map(([url]) => url)).toEqual(['https://pug.social/pug.png', 'https://pug.social/blobcat.png']);
        expect(progress).toEqual([[0, 2], [1, 2], [2, 2]]);
    });
});

describe('runSetup', () => {
    it("downloads a new server's emoji, their images and its limits", async () => {
        const queryClient = createTestQueryClient();
        const steps: SetupProgress['step'][] = [];

        await runSetup(queryClient, progress => steps.push(progress.step));

        expect([...new Set(steps)]).toEqual(['emojis', 'images', 'limits']);
        expect(queryClient.getQueryData(CUSTOM_EMOJIS_KEY)).toHaveLength(3);
        expect((await loadCachedEmojis('https://pug.social'))?.emojis).toHaveLength(3);
        expect(prefetch).toHaveBeenCalledTimes(2);
        expect(queryClient.getQueryData(['instance', 'configuration'])).toEqual(expect.objectContaining({ maxCharacters: 500 }));
    });

    it('skips everything for a server it already knows, loading its stored emoji', async () => {
        await saveCachedEmojis('https://pug.social', [emoji('pug')]);
        const queryClient = createTestQueryClient();
        const onProgress = jest.fn();

        await runSetup(queryClient, onProgress);

        expect(onProgress).not.toHaveBeenCalled();
        expect(mockedFetchEmojis).not.toHaveBeenCalled();
        expect(queryClient.getQueryData(CUSTOM_EMOJIS_KEY)).toEqual([emoji('pug')]);
    });

    it('carries on when the emoji request fails', async () => {
        mockedFetchEmojis.mockRejectedValue(new Error('network'));
        const queryClient = createTestQueryClient();

        await expect(runSetup(queryClient, jest.fn())).resolves.toBeUndefined();
        expect(mockedInstance).toHaveBeenCalled();
    });
});

describe('setupFraction', () => {
    it('fills one bar across the steps, mostly while images download', () => {
        expect(setupFraction({ step: 'emojis', imagesDone: 0, imagesTotal: 0 })).toBe(0.05);
        expect(setupFraction({ step: 'images', imagesDone: 0, imagesTotal: 5000 })).toBe(0.1);
        expect(setupFraction({ step: 'images', imagesDone: 2500, imagesTotal: 5000 })).toBeCloseTo(0.5);
        expect(setupFraction({ step: 'limits', imagesDone: 0, imagesTotal: 0 })).toBe(0.95);
    });
});

describe('Setup screen', () => {
    const renderSetup = (onDone = jest.fn()) =>
        render(
            <QueryClientProvider client={createTestQueryClient()}>
                <Setup onDone={onDone} />
            </QueryClientProvider>
        );

    it('shows the steps and finishes once everything is downloaded', async () => {
        // Images stay downloading until released, so the steps can be seen
        const pending: (() => void)[] = [];
        prefetch.mockImplementation(() => new Promise(resolve => pending.push(() => resolve(true))));
        const onDone = jest.fn();
        await renderSetup(onDone);

        expect(await screen.findByRole('header', { name: 'Setting things up' })).toBeTruthy();
        expect(await screen.findByText('pug.social')).toBeTruthy();
        // A pug message instead of how many emoji there are
        expect(screen.getByText(`${SETUP_MESSAGES[0]}…`, { includeHiddenElements: true })).toBeTruthy();
        expect(screen.queryByText(/\d+ \/ \d+/, { includeHiddenElements: true })).toBeNull();
        await waitFor(() => expect(screen.getByRole('progressbar', { name: 'Setting things up' }).props.accessibilityValue.now).toBe(10));
        expect(onDone).not.toHaveBeenCalled();

        await waitFor(() => expect(pending).toHaveLength(2));
        await act(async () => pending.forEach(release => release()));

        await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    });

    it('rotates through pug messages while it works', async () => {
        jest.useFakeTimers();
        try {
            prefetch.mockImplementation(() => new Promise(() => {}));
            await renderSetup();
            await act(async () => {
                await jest.advanceTimersByTimeAsync(0);
            });
            expect(screen.getByText(`${SETUP_MESSAGES[0]}…`, { includeHiddenElements: true })).toBeTruthy();

            await act(async () => {
                await jest.advanceTimersByTimeAsync(2500);
            });
            expect(screen.getByText(`${SETUP_MESSAGES[1]}…`, { includeHiddenElements: true })).toBeTruthy();
        } finally {
            jest.useRealTimers();
        }
    });

    it('can be skipped', async () => {
        prefetch.mockImplementation(() => new Promise(() => {}));
        const onDone = jest.fn();
        await renderSetup(onDone);

        await fireEvent.press(await screen.findByRole('button', { name: 'Skip' }));

        expect(onDone).toHaveBeenCalledTimes(1);
    });

    it('goes straight through for a known server without showing the steps', async () => {
        await saveCachedEmojis('https://pug.social', [emoji('pug')]);
        const onDone = jest.fn();
        await renderSetup(onDone);

        await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
        expect(screen.queryByRole('header', { name: 'Setting things up' })).toBeNull();
    });
});

describe('useEmojiCachePrimer', () => {
    const prime = async (accountId: string | undefined) => {
        const queryClient = createTestQueryClient();
        await renderHook(() => useEmojiCachePrimer(accountId), {
            wrapper: ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
        });
        return queryClient;
    };

    it("loads the server's stored emoji without refetching fresh ones", async () => {
        await saveCachedEmojis('https://pug.social', [emoji('pug')]);

        const queryClient = await prime('1');

        await waitFor(() => expect(queryClient.getQueryData(CUSTOM_EMOJIS_KEY)).toEqual([emoji('pug')]));
        expect(mockedFetchEmojis).not.toHaveBeenCalled();
    });

    it('refreshes stale stored emoji in the background', async () => {
        await saveCachedEmojis('https://pug.social', [emoji('pug')], Date.now() - EMOJI_STALE_TIME - 1000);

        const queryClient = await prime('1');

        await waitFor(() => expect(queryClient.getQueryData(CUSTOM_EMOJIS_KEY)).toHaveLength(3));
        expect(mockedFetchEmojis).toHaveBeenCalledTimes(1);
    });

    it('does nothing while logged out', async () => {
        const queryClient = await prime(undefined);

        await new Promise(resolve => setImmediate(resolve));
        expect(queryClient.getQueryData(CUSTOM_EMOJIS_KEY)).toBeUndefined();
        expect(mockedFetchEmojis).not.toHaveBeenCalled();
    });
});
