import React from 'react';
import { Alert, DeviceEventEmitter } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { InfiniteData, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils/queryClient';
import apiClient from '../services/api/client';
import { deleteStatus, editStatus, getStatusHistory, getStatusSource } from '../services/mastodon/statuses';
import { STATUS_DELETED_EVENT, STATUS_UPDATED_EVENT, useRemoveCachedStatus } from '../hooks/useUpdateCachedStatus';
import { TootCard } from '../components/TootCard/tootCard';
import { MediaViewerProvider } from '../components/MediaViewer/mediaViewer';
import ComposeModal from '../components/ComposeModal/composeModal';
import { NavigationProvider } from '../services/navigationContext';
import { DEFAULT_INSTANCE_CONFIGURATION } from '../services/mastodon/instance';
import { Account, Status } from '../services/mastodon/types';

jest.mock('../services/api/client', () => ({
    __esModule: true,
    default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));
jest.mock('../services/storage', () => ({
    getCredentials: async () => ({ accessToken: 'token', instanceUrl: 'https://home.social' }),
}));
const me: Account = { id: 'me', username: 'me', acct: 'me', display_name: 'Me', avatar: '', emojis: [] };
jest.mock('../services/authContext', () => ({ useAuth: () => ({ user: me }), useOptionalAuth: () => ({ user: me }) }));
jest.mock('../services/themeContext', () => ({
    useTheme: () => jest.requireActual('../testUtils/theme').mockTheme,
}));
jest.mock('../services/settingsContext', () => ({
    useSettings: () => ({ compactMode: false, mediaAutoplay: false }),
}));
const mockOpenCompose = jest.fn();
jest.mock('../services/composeContext', () => ({
    useCompose: () => ({ openCompose: mockOpenCompose }),
}));
jest.mock('../services/mastodon/customEmojis', () => ({ fetchCustomEmojis: jest.fn(async () => []) }));
jest.mock('../services/mastodon/instance', () => ({
    ...jest.requireActual('../services/mastodon/instance'),
    fetchInstanceConfiguration: jest.fn(async () => ({ ...jest.requireActual('../services/mastodon/instance').DEFAULT_INSTANCE_CONFIGURATION, supportsQuotes: true })),
}));

const api = apiClient as unknown as Record<'get' | 'post' | 'put' | 'delete', jest.Mock>;
const ana: Account = { id: 'ana', username: 'ana', acct: 'ana', display_name: 'Ana', avatar: '', emojis: [] };
const image = { id: 'm1', type: 'image' as const, url: 'https://home.social/m1.jpg', preview_url: 'https://home.social/m1s.jpg', description: 'A pug', meta: { original: { width: 800, height: 600 } } };

const post = (extra: Partial<Status> = {}): Status =>
    ({
        id: 'p1',
        created_at: new Date().toISOString(),
        in_reply_to_id: null,
        in_reply_to_account_id: null,
        sensitive: false,
        spoiler_text: '',
        visibility: 'unlisted',
        language: 'en',
        uri: 'https://home.social/statuses/p1',
        url: 'https://home.social/@me/p1',
        replies_count: 0,
        reblogs_count: 0,
        favourites_count: 0,
        content: '<p>Hello pugs</p>',
        reblog: null,
        account: me,
        media_attachments: [],
        emojis: [],
        ...extra,
    }) as Status;

let queryClient: QueryClient;
const wrap = (children: React.ReactNode) => (
    <QueryClientProvider client={queryClient}>
        <NavigationProvider>
            <MediaViewerProvider>{children}</MediaViewerProvider>
        </NavigationProvider>
    </QueryClientProvider>
);
const confirmAlert = async () => {
    const [, , buttons] = (Alert.alert as jest.Mock).mock.calls.at(-1);
    await act(async () => buttons.find((button: { style?: string }) => button.style === 'destructive').onPress());
};

beforeEach(() => {
    jest.clearAllMocks();
    queryClient = createTestQueryClient();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    api.get.mockResolvedValue({ data: [] });
    api.post.mockResolvedValue({ data: {} });
    api.put.mockImplementation(async (url: string, body: object) => ({ data: { ...post(), ...body, edited_at: new Date().toISOString() } }));
    api.delete.mockResolvedValue({ data: { ...post(), text: 'Hello pugs, as typed' } });
});
afterEach(() => jest.restoreAllMocks());

describe('post services', () => {
    it('deletes, edits and reads a post’s source and history', async () => {
        await deleteStatus('p1');
        await deleteStatus('p1', { deleteMedia: true });
        await editStatus('p1', { status: 'Hi' });
        await getStatusSource('p1');
        await getStatusHistory('p1');

        expect(api.delete).toHaveBeenNthCalledWith(1, '/statuses/p1', { params: undefined });
        expect(api.delete).toHaveBeenNthCalledWith(2, '/statuses/p1', { params: { delete_media: true } });
        expect(api.put).toHaveBeenCalledWith('/statuses/p1', { status: 'Hi' });
        expect(api.get.mock.calls.map(call => call[0])).toEqual(['/statuses/p1/source', '/statuses/p1/history']);
    });

    it('removes a deleted post, and boosts of it, from every cached list', async () => {
        const timeline: InfiniteData<Status[]> = { pages: [[post(), post({ id: 'b1', reblog: post() }), post({ id: 'p2' })]], pageParams: [undefined] };
        queryClient.setQueryData(['timeline', 'home'], timeline);
        const deleted = jest.fn();
        const subscription = DeviceEventEmitter.addListener(STATUS_DELETED_EVENT, deleted);
        let remove: (id: string) => void = () => {};
        const Probe = () => {
            remove = useRemoveCachedStatus();
            return null;
        };
        await render(wrap(<Probe />));

        await act(async () => remove('p1'));

        expect(queryClient.getQueryData<InfiniteData<Status[]>>(['timeline', 'home'])?.pages[0].map(status => status.id)).toEqual(['p2']);
        expect(deleted).toHaveBeenCalledWith('p1');
        subscription.remove();
    });
});

describe('Your own posts', () => {
    const openMenu = async (status = post()) => {
        await render(wrap(<TootCard status={status} />));
        await fireEvent.press(screen.getByRole('button', { name: 'More options for this post' }));
    };

    it('opens compose to edit', async () => {
        await openMenu();
        await fireEvent.press(await screen.findByRole('button', { name: 'Edit' }));

        await waitFor(() => expect(mockOpenCompose).toHaveBeenCalledWith({ existingPost: { mode: 'edit', status: expect.objectContaining({ id: 'p1' }) } }));
    });

    it('asks before deleting, then removes the post everywhere', async () => {
        queryClient.setQueryData(['timeline', 'home'], { pages: [[post()]], pageParams: [undefined] });
        await openMenu();
        await fireEvent.press(await screen.findByRole('button', { name: 'Delete' }));

        expect(Alert.alert).toHaveBeenCalledWith('Delete this post?', expect.any(String), expect.any(Array));
        expect(api.delete).not.toHaveBeenCalled();
        await confirmAlert();

        expect(api.delete).toHaveBeenCalledWith('/statuses/p1', { params: undefined });
        expect(queryClient.getQueryData<InfiniteData<Status[]>>(['timeline', 'home'])?.pages[0]).toEqual([]);
    });

    it('deletes and brings the text back to redraft', async () => {
        await openMenu();
        await fireEvent.press(await screen.findByRole('button', { name: 'Delete and redraft' }));
        await confirmAlert();

        await waitFor(() =>
            expect(mockOpenCompose).toHaveBeenCalledWith({
                existingPost: { mode: 'redraft', status: expect.objectContaining({ id: 'p1', text: 'Hello pugs, as typed' }) },
            })
        );
    });

    it('marks edited posts and shows their history', async () => {
        api.get.mockResolvedValue({
            data: [
                { content: '<p>Helo pugs</p>', spoiler_text: '', sensitive: false, created_at: '2026-10-01T10:00:00Z', account: me, media_attachments: [], emojis: [] },
                { content: '<p>Hello pugs</p>', spoiler_text: '', sensitive: false, created_at: '2026-10-01T10:05:00Z', account: me, media_attachments: [image], emojis: [] },
            ],
        });
        await render(wrap(<TootCard status={post({ edited_at: '2026-10-01T10:05:00Z' })} />));

        await fireEvent.press(screen.getByRole('button', { name: 'Edited; see the edit history' }));

        expect(await screen.findByText('Helo pugs')).toBeTruthy();
        expect(screen.getByText('Original')).toBeTruthy();
        expect(screen.getByText('1 attachment')).toBeTruthy();
        expect(api.get).toHaveBeenCalledWith('/statuses/p1/history');
    });
});

describe('Compose with your post', () => {
    const renderCompose = (mode: 'edit' | 'redraft', status: Status) =>
        render(wrap(<ComposeModal isOpen replyToStatus={null} existingPost={{ mode, status }} closeCompose={jest.fn()} />));

    it('edits from the source, keeping the visibility and saving descriptions as media attributes', async () => {
        api.get.mockImplementation(async (url: string) =>
            url === '/statuses/p1/source' ? { data: { id: 'p1', text: 'Hello #pugs', spoiler_text: '' } } : { data: [] }
        );
        const updated = jest.fn();
        const subscription = DeviceEventEmitter.addListener(STATUS_UPDATED_EVENT, updated);
        await renderCompose('edit', post({ media_attachments: [image] }));

        expect(screen.getByRole('header', { name: 'Edit post' })).toBeTruthy();
        await waitFor(() => expect(screen.getByLabelText('Post text').props.value).toBe('Hello #pugs'));
        expect(screen.getByRole('button', { name: 'Visibility: Unlisted' })).toBeDisabled();
        expect(screen.queryByRole('button', { name: 'Edit image 1' })).toBeNull();
        await fireEvent.changeText(screen.getByLabelText('Post text'), 'Hello #pugs!');
        await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(api.put).toHaveBeenCalled());
        expect(api.put).toHaveBeenCalledWith('/statuses/p1', expect.objectContaining({
            status: 'Hello #pugs!',
            media_ids: ['m1'],
            media_attributes: [{ id: 'm1', description: 'A pug', focus: undefined }],
            poll: undefined,
        }));
        expect(api.post).not.toHaveBeenCalledWith('/statuses', expect.anything());
        expect(updated).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }));
        subscription.remove();
    });

    it("keeps an edited post's poll as it is", async () => {
        const poll = { id: 'poll', expires_at: new Date(Date.now() + 3600 * 1000).toISOString(), expired: false, multiple: true, votes_count: 3, voters_count: 3, voted: false, own_votes: [], options: [{ title: 'Tea', votes_count: 1 }, { title: 'Coffee', votes_count: 2 }], emojis: [] };
        await renderCompose('edit', post({ poll }));

        expect(screen.getByText('· Tea')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Poll' })).toBeDisabled();
        await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(api.put).toHaveBeenCalled());
        const { poll: sent } = api.put.mock.calls[0][1];
        expect(sent.options).toEqual(['Tea', 'Coffee']);
        expect(sent.multiple).toBe(true);
        expect(sent.expires_in).toBeGreaterThan(3500);
    });

    it('redrafts as a new post, reusing the images and the reply', async () => {
        api.post.mockResolvedValue({ data: post({ id: 'p9' }) });
        await renderCompose('redraft', post({ text: 'Hello pugs, as typed', in_reply_to_id: 'parent', media_attachments: [image] } as Partial<Status>));

        expect(screen.getByLabelText('Post text').props.value).toBe('Hello pugs, as typed');
        expect(screen.getByText('✓ ALT')).toBeTruthy();
        await fireEvent.press(screen.getByRole('button', { name: 'Post' }));

        await waitFor(() => expect(api.post).toHaveBeenCalledWith('/statuses', expect.objectContaining({
            status: 'Hello pugs, as typed',
            in_reply_to_id: 'parent',
            media_ids: ['m1'],
            visibility: 'unlisted',
        })));
        // The description didn't change, so nothing to update first
        expect(api.put).not.toHaveBeenCalled();
    });
});
