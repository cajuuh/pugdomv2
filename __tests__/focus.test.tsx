import React from 'react';
import { Alert, Image, StyleSheet } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { createTestQueryClient } from '../testUtils/queryClient';
import apiClient from '../services/api/client';
import { focusedCover, fromMastodonFocus, toMastodonFocus } from '../services/media/geometry';
import { updateMedia } from '../services/mastodon/media';
import ComposeModal from '../components/ComposeModal/composeModal';
import { TootCard } from '../components/TootCard/tootCard';
import { MediaViewerProvider } from '../components/MediaViewer/mediaViewer';
import { createStatus } from '../services/mastodon/statuses';
import { Account, Attachment, Status } from '../services/mastodon/types';

jest.mock('../services/api/client', () => ({
    __esModule: true,
    default: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}));
jest.mock('../services/storage', () => ({
    getCredentials: async () => ({ accessToken: 'token', instanceUrl: 'https://home.social' }),
}));
const me: Account = { id: '1', username: 'me', acct: 'me', display_name: 'Me', avatar: '', emojis: [] };
jest.mock('../services/authContext', () => ({ useAuth: () => ({ user: me }) }));
jest.mock('../services/themeContext', () => ({
    useTheme: () => jest.requireActual('../testUtils/theme').mockTheme,
}));
jest.mock('../services/settingsContext', () => ({
    useSettings: () => ({ compactMode: false, mediaAutoplay: false }),
}));
jest.mock('../services/mastodon/statuses', () => ({ createStatus: jest.fn() }));
jest.mock('../services/composeContext', () => ({
    ...jest.requireActual('../services/composeContext'),
    useCompose: () => ({ openCompose: jest.fn() }),
}));
jest.mock('../services/mastodon/customEmojis', () => ({ fetchCustomEmojis: jest.fn(async () => []) }));

const api = apiClient as unknown as Record<'get' | 'post' | 'put', jest.Mock>;
const library = ImagePicker.launchImageLibraryAsync as jest.Mock;
const layout = (width: number, height: number) => ({ nativeEvent: { layout: { x: 0, y: 0, width, height } } });

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(Image, 'getSize').mockImplementation((async () => ({ width: 1000, height: 500 })) as typeof Image.getSize);
    (createStatus as jest.Mock).mockResolvedValue({} as Status);
    api.get.mockResolvedValue({ data: {} });
    let next = 0;
    api.post.mockImplementation(async () => ({ status: 200, data: { id: `m${++next}`, type: 'image', url: 'https://home.social/m.jpg', preview_url: '' } }));
    api.put.mockResolvedValue({ data: {} });
});
afterEach(() => jest.restoreAllMocks());

describe('focal point maths', () => {
    it("converts to Mastodon's -1..1 with y pointing up, and back", () => {
        expect(toMastodonFocus({ x: 0.5, y: 0.5 })).toEqual({ x: 0, y: 0 });
        expect(toMastodonFocus({ x: 0, y: 0 })).toEqual({ x: -1, y: 1 });
        expect(toMastodonFocus({ x: 1, y: 1 })).toEqual({ x: 1, y: -1 });
        expect(fromMastodonFocus(toMastodonFocus({ x: 0.25, y: 0.75 }))).toEqual({ x: 0.25, y: 0.75 });
    });

    it('covers the box, keeping the focal point as central as the edges allow', () => {
        // A 2:1 image in a square box is scaled to 200×100... then to cover: 200 tall, 400 wide
        const box = { width: 200, height: 200 };
        const image = { width: 1000, height: 500 };

        expect(focusedCover(box, image, { x: 0.5, y: 0.5 })).toEqual({ width: 400, height: 200, left: -100, top: 0 });
        // Near the right edge: shifted as far as the image allows
        expect(focusedCover(box, image, { x: 0.9, y: 0.5 })).toEqual({ width: 400, height: 200, left: -200, top: 0 });
        expect(focusedCover(box, image, { x: 0.1, y: 0.5 })).toEqual({ width: 400, height: 200, left: 0, top: 0 });
        expect(focusedCover(box, image, { x: 0.375, y: 0.5 }).left).toBe(-50);
    });

    it('sends the focal point with the description', async () => {
        await updateMedia('m1', { description: 'A pug', focus: { x: 0.75, y: 0.25 } });
        expect(api.put).toHaveBeenCalledWith('/media/m1', { description: 'A pug', focus: '0.50,0.50' });

        await updateMedia('m1', { description: 'A pug' });
        expect(api.put).toHaveBeenLastCalledWith('/media/m1', { description: 'A pug' });
    });
});

describe('Picking the focal point in compose', () => {
    const renderCompose = async () => {
        await render(
            <QueryClientProvider client={createTestQueryClient()}>
                <ComposeModal isOpen replyToStatus={null} closeCompose={jest.fn()} />
            </QueryClientProvider>
        );
        library.mockResolvedValueOnce({
            canceled: false,
            assets: [{ uri: 'file:///photos/a.jpg', width: 1000, height: 500, mimeType: 'image/jpeg', fileName: 'a.jpg' }],
        });
        await fireEvent.press(screen.getByRole('button', { name: 'Add images' }));
        await waitFor(() => expect(screen.getByRole('button', { name: 'Post' })).toBeEnabled());
    };

    // The description screen's image is 400 wide: 400×200 for a 2:1 photo
    const openDescription = async () => {
        await fireEvent.press(screen.getByRole('button', { name: 'Describe image 1' }));
        await fireEvent(screen.getByTestId('focus-image-box'), 'layout', layout(400, 300));
    };

    it('marks the tapped point and saves it with the description', async () => {
        await renderCompose();
        await openDescription();

        await fireEvent.press(screen.getByRole('button', { name: 'Focal point' }), { nativeEvent: { locationX: 300, locationY: 50 } });
        expect(StyleSheet.flatten(screen.getByTestId('focus-crosshair').props.style)).toMatchObject({ left: 300 - 14, top: 50 - 14 });
        await fireEvent.changeText(screen.getByLabelText('Description'), 'A pug on the right');
        await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
        await fireEvent.press(screen.getByRole('button', { name: 'Post' }));

        await waitFor(() => expect(createStatus).toHaveBeenCalled());
        // x 0.75 → 0.5; y 0.25 → 0.5 (up is positive)
        expect(api.put).toHaveBeenCalledWith('/media/m1', { description: 'A pug on the right', focus: '0.50,0.50' });
    });

    it('centers it again, and forgets it on cancel', async () => {
        await renderCompose();
        await openDescription();

        await fireEvent.press(screen.getByRole('button', { name: 'Focal point' }), { nativeEvent: { locationX: 100, locationY: 100 } });
        await fireEvent.press(screen.getByRole('button', { name: 'Center' }));
        expect(screen.queryByTestId('focus-crosshair')).toBeNull();

        await fireEvent.press(screen.getByRole('button', { name: 'Focal point' }), { nativeEvent: { locationX: 100, locationY: 100 } });
        await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
        await openDescription();
        expect(screen.queryByTestId('focus-crosshair')).toBeNull();
    });
});

describe('Editing an image with a focal point', () => {
    it('drops the focal point, which may no longer be on the picture', async () => {
        await render(
            <QueryClientProvider client={createTestQueryClient()}>
                <ComposeModal isOpen replyToStatus={null} closeCompose={jest.fn()} />
            </QueryClientProvider>
        );
        library.mockResolvedValueOnce({
            canceled: false,
            assets: [{ uri: 'file:///photos/a.jpg', width: 1000, height: 500, mimeType: 'image/jpeg', fileName: 'a.jpg' }],
        });
        await fireEvent.press(screen.getByRole('button', { name: 'Add images' }));
        await waitFor(() => expect(screen.getByRole('button', { name: 'Post' })).toBeEnabled());
        await fireEvent.press(screen.getByRole('button', { name: 'Describe image 1' }));
        await fireEvent(screen.getByTestId('focus-image-box'), 'layout', layout(400, 300));
        await fireEvent.press(screen.getByRole('button', { name: 'Focal point' }), { nativeEvent: { locationX: 300, locationY: 50 } });
        await fireEvent.changeText(screen.getByLabelText('Description'), 'A pug');
        await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

        await fireEvent.press(screen.getByRole('button', { name: 'Edit image 1' }));
        await fireEvent(screen.getByTestId('image-editor-stage'), 'layout', layout(488, 488));
        await fireEvent.press(screen.getByRole('button', { name: 'Rotate' }));
        await fireEvent.press(screen.getAllByRole('button', { name: 'Done' }).at(-1)!);
        await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(screen.getByRole('button', { name: 'Post' })).toBeEnabled());
        await fireEvent.press(screen.getByRole('button', { name: 'Post' }));

        await waitFor(() => expect(createStatus).toHaveBeenCalled());
        expect(api.put).toHaveBeenCalledWith('/media/m2', { description: 'A pug' });
    });
});

describe('Images in posts', () => {
    const image = (extra: Partial<Attachment> = {}): Attachment => ({
        id: 'a1',
        type: 'image',
        url: 'https://home.social/full.jpg',
        preview_url: 'https://home.social/small.jpg',
        ...extra,
    });
    const post = (media: Attachment[]): Status =>
        ({
            id: 's1',
            created_at: new Date().toISOString(),
            sensitive: false,
            spoiler_text: '',
            visibility: 'public',
            uri: 'https://home.social/s1',
            url: 'https://home.social/@me/s1',
            replies_count: 0,
            reblogs_count: 0,
            favourites_count: 0,
            content: '<p>look</p>',
            reblog: null,
            account: me,
            media_attachments: media,
            emojis: [],
        }) as unknown as Status;
    const renderPost = (media: Attachment[]) =>
        render(
            <QueryClientProvider client={createTestQueryClient()}>
                <MediaViewerProvider>
                    <TootCard status={post(media)} />
                </MediaViewerProvider>
            </QueryClientProvider>
        );

    it('shows an ALT chip on described images, which reads the description', async () => {
        await renderPost([image({ description: 'A pug asleep' }), image({ id: 'a2' })]);

        expect(screen.getAllByRole('button', { name: 'Read the image description' })).toHaveLength(1);
        await fireEvent.press(screen.getByRole('button', { name: 'Read the image description' }));

        expect(await screen.findByRole('header', { name: 'Image description' })).toBeTruthy();
        expect(screen.getAllByText('A pug asleep').length).toBeGreaterThan(0);
    });

    it('crops around the focal point', async () => {
        // Focus on the right: 0.6 in Mastodon's units is 0.8 across
        await renderPost([image({ meta: { original: { width: 1000, height: 500 }, focus: { x: 0.6, y: 0 } } })]);
        const placed = () => StyleSheet.flatten(screen.getByTestId('focused-image-picture').props.style);

        await fireEvent(screen.getByTestId('focused-image'), 'layout', layout(400, 200));
        // 2:1 into 2:1: no room to shift
        expect(placed()).toMatchObject({ width: 400, height: 200, left: 0, top: 0 });

        await fireEvent(screen.getByTestId('focused-image'), 'layout', layout(200, 200));
        // 400 wide in a 200 box: 0.8 of the way across is 320, as central as the edge allows (-200)
        expect(placed()).toMatchObject({ width: 400, height: 200, left: -200, top: 0 });
    });
});

describe('Compose margins', () => {
    it('keeps the description screen and the image strip off the screen edges', async () => {
        await render(
            <QueryClientProvider client={createTestQueryClient()}>
                <ComposeModal isOpen replyToStatus={null} closeCompose={jest.fn()} />
            </QueryClientProvider>
        );
        library.mockResolvedValueOnce({
            canceled: false,
            assets: [{ uri: 'file:///photos/a.jpg', width: 1000, height: 500, mimeType: 'image/jpeg', fileName: 'a.jpg' }],
        });
        await fireEvent.press(screen.getByRole('button', { name: 'Add images' }));
        await waitFor(() => expect(screen.getByRole('button', { name: 'Post' })).toBeEnabled());

        // space.lg, like the poll and content warning boxes
        expect(StyleSheet.flatten(screen.getByTestId('attachment-strip').props.contentContainerStyle)).toMatchObject({ paddingHorizontal: 16 });

        await fireEvent.press(screen.getByRole('button', { name: 'Describe image 1' }));
        expect(StyleSheet.flatten(screen.getByTestId('alt-text-editor').props.style)).toMatchObject({ paddingHorizontal: 16 });
    });
});
