import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils/queryClient';
import apiClient from '../services/api/client';
import { TootCard } from '../components/TootCard/tootCard';
import { DialogHost } from '../components/Dialog/dialogHost';
import { NavigationProvider } from '../services/navigationContext';
import { Account, Status } from '../services/mastodon/types';

jest.mock('../components/MediaViewer/mediaViewer', () => ({
    MediaViewerProvider: ({ children }: { children: React.ReactNode }) => children,
    useMediaViewer: () => ({ openMedia: jest.fn() }),
    useOptionalMediaViewer: () => undefined,
}));
jest.mock('../services/api/client', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
jest.mock('../services/storage', () => ({
    ...jest.requireActual('../services/storage'),
    getCredentials: async () => ({ accessToken: 'token', instanceUrl: 'https://one.social' }),
}));
const me: Account = { id: 'me', username: 'me', acct: 'me', display_name: 'Me', avatar: '', emojis: [] };
jest.mock('../services/authContext', () => ({ useAuth: () => ({ user: me }), useOptionalAuth: () => ({ user: me }) }));
jest.mock('../services/themeContext', () => ({ useTheme: () => jest.requireActual('../testUtils/theme').mockTheme }));
jest.mock('../services/settingsContext', () => ({ useSettings: () => ({ compactMode: false, mediaAutoplay: false }) }));
jest.mock('../services/composeContext', () => ({ useCompose: () => ({ openCompose: jest.fn() }) }));

const api = apiClient as unknown as Record<'get' | 'post', jest.Mock>;
const ana: Account = { id: 'ana', username: 'ana', acct: 'ana@art.social', display_name: 'Ana', avatar: '', emojis: [] };
const post = (extra: Partial<Status> = {}): Status =>
    ({
        id: 'p1',
        created_at: new Date().toISOString(),
        spoiler_text: '',
        visibility: 'public',
        language: 'pt',
        replies_count: 0,
        reblogs_count: 0,
        favourites_count: 0,
        content: '<p>Bom dia, pugs</p>',
        account: ana,
        media_attachments: [],
        emojis: [],
        ...extra,
    }) as Status;

let queryClient: QueryClient;
let translationOn = true;
const renderPost = (status: Status) =>
    render(
        <QueryClientProvider client={queryClient}>
            <NavigationProvider>
                <TootCard status={status} />
                <DialogHost />
            </NavigationProvider>
        </QueryClientProvider>
    );

beforeEach(() => {
    jest.clearAllMocks();
    queryClient = createTestQueryClient();
    translationOn = true;
    api.get.mockImplementation(async (url: string) =>
        url.endsWith('/api/v2/instance') ? { data: { configuration: { statuses: { max_characters: 500 }, translation: { enabled: translationOn } } } } : { data: [] }
    );
    api.post.mockImplementation(async () => ({
        data: { content: '<p>Good morning, pugs</p>', spoiler_text: '', detected_source_language: 'pt', provider: 'DeepL.com' },
    }));
});

describe('Translating a post', () => {
    it('translates a post in another language, and shows the original again', async () => {
        await renderPost(post());

        await fireEvent.press(await screen.findByRole('button', { name: 'Translate' }));

        expect(await screen.findByText('Good morning, pugs')).toBeTruthy();
        expect(api.post).toHaveBeenCalledWith('/statuses/p1/translate', { lang: 'en' });
        expect(screen.getByText('Translated from Portuguese · DeepL.com')).toBeTruthy();
        expect(screen.queryByText('Bom dia, pugs')).toBeNull();

        await fireEvent.press(screen.getByRole('button', { name: 'Show original' }));
        expect(screen.getByText('Bom dia, pugs')).toBeTruthy();

        // Asked once: the second time comes from the cache
        await fireEvent.press(screen.getByRole('button', { name: 'Translate' }));
        expect(await screen.findByText('Good morning, pugs')).toBeTruthy();
        expect(api.post).toHaveBeenCalledTimes(1);
    });

    it("isn't offered for posts in your language, private posts, or when the server doesn't translate", async () => {
        await renderPost(post({ id: 'same', language: 'en' }));
        await renderPost(post({ id: 'private', visibility: 'private' }));
        const instanceCalls = () => api.get.mock.calls.filter(([url]) => url.endsWith('/api/v2/instance')).length;
        await waitFor(() => expect(instanceCalls()).toBe(1));
        expect(screen.queryByRole('button', { name: 'Translate' })).toBeNull();

        translationOn = false;
        queryClient = createTestQueryClient();
        await renderPost(post({ id: 'off' }));
        await waitFor(() => expect(instanceCalls()).toBe(2));
        expect(screen.queryByRole('button', { name: 'Translate' })).toBeNull();
    });

    it("leaves out the language's name when it doesn't know it", async () => {
        api.post.mockResolvedValueOnce({ data: { content: '<p>Good morning, pugs</p>', spoiler_text: '', detected_source_language: 'tl', provider: 'LibreTranslate' } });
        await renderPost(post({ language: 'tl' }));

        await fireEvent.press(await screen.findByRole('button', { name: 'Translate' }));

        expect(await screen.findByText('Translated · LibreTranslate')).toBeTruthy();
    });

    it('says when the translation fails, and lets you try again', async () => {
        api.post.mockRejectedValueOnce(new Error('503'));
        await renderPost(post());

        await fireEvent.press(await screen.findByRole('button', { name: 'Translate' }));

        expect(await screen.findByText("Couldn't translate this post")).toBeTruthy();
        expect(screen.getByText('Bom dia, pugs')).toBeTruthy();
        await fireEvent.press(screen.getByRole('button', { name: 'Translate' }));
        expect(await screen.findByText('Good morning, pugs')).toBeTruthy();
    });
});
