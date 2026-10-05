import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator } from 'expo-image-manipulator';
import { createTestQueryClient } from '../testUtils/queryClient';
import apiClient from '../services/api/client';
import { PROCESSING_POLL_MS, updateMedia, uploadMedia } from '../services/mastodon/media';
import { DEFAULT_INSTANCE_CONFIGURATION, fetchInstanceConfiguration } from '../services/mastodon/instance';
import { PickedImage, prepareImage, preparePlan } from '../services/media/prepare';
import { pickImages, takePhoto } from '../services/media/pick';
import { createStatus } from '../services/mastodon/statuses';
import ComposeModal from '../components/ComposeModal/composeModal';
import { Account, Status } from '../services/mastodon/types';

jest.mock('../services/api/client', () => ({
    __esModule: true,
    default: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}));
jest.mock('../services/storage', () => ({
    getCredentials: async () => ({ accessToken: 'token', instanceUrl: 'https://home.social' }),
}));
const me: Account = { id: '1', username: 'me', acct: 'me', display_name: 'Me', avatar: '', emojis: [] };
jest.mock('../services/authContext', () => ({ useAuth: () => ({ user: me }), useOptionalAuth: () => ({ user: me }) }));
jest.mock('../services/themeContext', () => ({
    useTheme: () => jest.requireActual('../testUtils/theme').mockTheme,
}));
jest.mock('../services/mastodon/statuses', () => ({ createStatus: jest.fn() }));
jest.mock('../services/mastodon/customEmojis', () => ({ fetchCustomEmojis: jest.fn(async () => []) }));

const api = apiClient as unknown as Record<'get' | 'post' | 'put', jest.Mock>;
const library = ImagePicker.launchImageLibraryAsync as jest.Mock;
const camera = ImagePicker.launchCameraAsync as jest.Mock;
const cameraPermission = ImagePicker.requestCameraPermissionsAsync as jest.Mock;

const photo = (name: string, extra: Partial<PickedImage> = {}): PickedImage => ({
    uri: `file:///photos/${name}`,
    width: 1200,
    height: 800,
    mimeType: 'image/jpeg',
    fileName: name,
    fileSize: 500000,
    ...extra,
});
const limits = DEFAULT_INSTANCE_CONFIGURATION;
const uploaded = (id: string) => ({ data: { id, type: 'image', url: `https://home.social/media/${id}.jpg`, preview_url: '' }, status: 200 });

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    (createStatus as jest.Mock).mockResolvedValue({} as Status);
    api.put.mockImplementation(async (url: string, body: object) => ({ data: { id: url.split('/').pop(), ...body } }));
    // The instance's limits; uploads get ids in order
    let next = 0;
    api.get.mockImplementation(async (url: string) => {
        if (url.endsWith('/api/v2/instance')) return { data: { configuration: { statuses: { max_media_attachments: 4 } } } };
        return { data: [] };
    });
    api.post.mockImplementation(async () => uploaded(`m${++next}`));
});
afterEach(() => jest.restoreAllMocks());

describe('media service', () => {
    it('uploads multipart to v2, reporting progress', async () => {
        const progress = jest.fn();
        api.post.mockImplementation(async (_url: string, _form: FormData, config: any) => {
            config.onUploadProgress({ loaded: 50, total: 100 });
            return uploaded('m1');
        });

        const media = await uploadMedia({ uri: 'file:///a.jpg', name: 'a.jpg', type: 'image/jpeg' }, { onProgress: progress });

        expect(media.id).toBe('m1');
        const [url, form, config] = api.post.mock.calls[0];
        expect(url).toBe('https://home.social/api/v2/media');
        expect(form).toBeInstanceOf(FormData);
        expect(config).toMatchObject({ headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 });
        expect(progress).toHaveBeenCalledWith(0.5);
    });

    it('waits while the server processes an upload', async () => {
        jest.useFakeTimers();
        try {
            api.post.mockResolvedValue({ status: 202, data: { id: 'm9', url: null } });
            api.get
                .mockResolvedValueOnce({ status: 206, data: { id: 'm9', url: null } })
                .mockResolvedValueOnce(uploaded('m9'));

            const uploading = uploadMedia({ uri: 'file:///a.gif', name: 'a.gif', type: 'image/gif' });
            await jest.advanceTimersByTimeAsync(PROCESSING_POLL_MS * 2);

            expect((await uploading).url).toBe('https://home.social/media/m9.jpg');
            expect(api.get).toHaveBeenCalledWith('/media/m9', expect.anything());
        } finally {
            jest.useRealTimers();
        }
    });

    it('updates a description', async () => {
        await updateMedia('m1', { description: 'A pug' });
        expect(api.put).toHaveBeenCalledWith('/media/m1', { description: 'A pug' });
    });

    it("reads the server's media limits", async () => {
        api.get.mockResolvedValue({
            data: {
                configuration: {
                    statuses: { max_media_attachments: 6 },
                    media_attachments: { image_size_limit: 1000, image_matrix_limit: 2000, description_limit: 900, supported_mime_types: ['image/png'] },
                },
            },
        });

        expect(await fetchInstanceConfiguration()).toMatchObject({
            maxMediaAttachments: 6,
            imageSizeLimit: 1000,
            imageMatrixLimit: 2000,
            descriptionLimit: 900,
            supportedMimeTypes: ['image/png'],
        });
    });
});

describe('preparing images', () => {
    it('sends GIFs and supported images as they are', () => {
        expect(preparePlan(photo('cat.gif', { mimeType: 'image/gif', width: 9000, height: 9000 }), limits)).toEqual({ action: 'keep' });
        expect(preparePlan(photo('cat.jpg'), limits)).toEqual({ action: 'keep' });
    });

    it('converts HEIC, oversized files and types the server does not take', () => {
        expect(preparePlan(photo('cat.heic', { mimeType: 'image/heic' }), limits)).toEqual({ action: 'convert' });
        expect(preparePlan(photo('cat.jpg', { fileSize: limits.imageSizeLimit + 1 }), limits)).toEqual({ action: 'convert' });
        expect(preparePlan(photo('cat.webp', { mimeType: 'image/webp' }), { ...limits, supportedMimeTypes: ['image/jpeg'] })).toEqual({ action: 'convert' });
    });

    it('scales images down to the pixel limit, keeping the shape', () => {
        const plan = preparePlan(photo('big.jpg', { width: 8000, height: 6000 }), { ...limits, imageMatrixLimit: 12000000 });
        expect(plan).toEqual({ action: 'convert', width: 4000, height: 3000 });
    });

    it('works out the type from the name when the picker does not say', async () => {
        expect(await prepareImage(photo('cat.png', { mimeType: null }), limits)).toEqual({ uri: 'file:///photos/cat.png', name: 'cat.png', type: 'image/png' });
    });

    it('re-encodes as JPEG when needed', async () => {
        const file = await prepareImage(photo('cat.heic', { mimeType: 'image/heic' }), limits);

        expect(ImageManipulator.manipulate).toHaveBeenCalledWith('file:///photos/cat.heic');
        expect(file).toEqual({ uri: 'file:///cache/converted.jpg', name: 'cat.jpg', type: 'image/jpeg' });
    });
});

describe('picking images', () => {
    it('asks the gallery for up to the remaining slots, keeping GIFs animated', async () => {
        library.mockResolvedValue({ canceled: false, assets: [photo('a.jpg'), photo('b.jpg')] });

        expect(await pickImages(2)).toHaveLength(2);
        expect(library).toHaveBeenCalledWith(expect.objectContaining({ mediaTypes: ['images'], quality: 1, allowsEditing: false, selectionLimit: 2, allowsMultipleSelection: true }));
        expect(await pickImages(0)).toEqual([]);
    });

    it('needs the camera permission to take a photo', async () => {
        cameraPermission.mockResolvedValueOnce({ granted: false });
        expect(await takePhoto()).toBe('denied');
        expect(camera).not.toHaveBeenCalled();
    });
});

describe('Compose with images', () => {
    const renderCompose = () =>
        render(
            <QueryClientProvider client={createTestQueryClient()}>
                <ComposeModal isOpen replyToStatus={null} closeCompose={jest.fn()} />
            </QueryClientProvider>
        );
    const pick = async (...names: string[]) => {
        library.mockResolvedValueOnce({ canceled: false, assets: names.map(name => photo(name)) });
        await fireEvent.press(screen.getByRole('button', { name: 'Add images' }));
    };
    const post = () => fireEvent.press(screen.getByRole('button', { name: 'Post' }));

    it('uploads picked images and posts them, even without text', async () => {
        await renderCompose();
        await pick('a.jpg', 'b.jpg');

        await waitFor(() => expect(screen.getByRole('button', { name: 'Post' })).toBeEnabled());
        expect(api.post).toHaveBeenCalledTimes(2);
        // No descriptions: the pug asks once, then lets it go
        await post();
        expect(await screen.findByText('Woof, woof! 🐾')).toBeTruthy();
        expect(screen.getByText(/noticed 2 images without a description/)).toBeTruthy();
        expect(createStatus).not.toHaveBeenCalled();

        await fireEvent.press(screen.getByRole('button', { name: 'Post anyway' }));

        await waitFor(() => expect(createStatus).toHaveBeenCalledWith(expect.objectContaining({ status: '', media_ids: ['m1', 'm2'] })));
        expect(api.put).not.toHaveBeenCalled();
    });

    it('describes an image, saving the description before posting', async () => {
        await renderCompose();
        await pick('a.jpg');
        await waitFor(() => expect(screen.getByRole('button', { name: 'Post' })).toBeEnabled());

        await fireEvent.press(screen.getByRole('button', { name: 'Describe image 1' }));
        expect(screen.getByRole('header', { name: 'Description' })).toBeTruthy();
        await fireEvent.changeText(screen.getByLabelText('Description'), 'A pug asleep on a sofa');
        await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
        expect(screen.getByText('✓ ALT')).toBeTruthy();

        await post();

        await waitFor(() => expect(createStatus).toHaveBeenCalledWith(expect.objectContaining({ media_ids: ['m1'] })));
        expect(api.put).toHaveBeenCalledWith('/media/m1', { description: 'A pug asleep on a sofa' });
        expect(screen.queryByText('Woof, woof! 🐾')).toBeNull();
    });

    it("opens the first undescribed image from the pug's reminder", async () => {
        await renderCompose();
        await pick('a.jpg');
        await waitFor(() => expect(screen.getByRole('button', { name: 'Post' })).toBeEnabled());
        await post();

        await fireEvent.press(await screen.findByRole('button', { name: 'Describe' }));

        expect(screen.getByRole('header', { name: 'Description' })).toBeTruthy();
        // Once per post: back in the post, Post goes straight through
        await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
        await post();
        await waitFor(() => expect(createStatus).toHaveBeenCalled());
    });

    it('waits for uploads, and offers a retry when one fails', async () => {
        api.post.mockRejectedValueOnce(new Error('offline'));
        await renderCompose();
        await fireEvent.changeText(screen.getByLabelText('Post text'), 'Look');
        await pick('a.jpg');

        await fireEvent.press(await screen.findByRole('button', { name: 'Upload image 1 again' }));

        await waitFor(() => expect(screen.getByRole('button', { name: 'Post' })).toBeEnabled());
        expect(api.post).toHaveBeenCalledTimes(2);
    });

    it('removes an image, and keeps images and polls apart', async () => {
        await renderCompose();
        await pick('a.jpg');

        expect(screen.getByRole('button', { name: 'Poll' })).toBeDisabled();
        await fireEvent.press(screen.getByRole('button', { name: 'Remove image 1' }));
        expect(screen.queryByRole('button', { name: 'Describe image 1' })).toBeNull();
        expect(screen.getByRole('button', { name: 'Poll' })).toBeEnabled();

        await fireEvent.press(screen.getByRole('button', { name: 'Poll' }));
        expect(screen.getByRole('button', { name: 'Add images' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Take a photo' })).toBeDisabled();
    });

    it('stops at the instance limit', async () => {
        await renderCompose();
        await act(async () => {});
        await pick('a.jpg', 'b.jpg', 'c.jpg', 'd.jpg', 'e.jpg');

        expect(screen.getByRole('button', { name: 'Describe image 4' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Describe image 5' })).toBeNull();
        expect(screen.getByRole('button', { name: 'Add images' })).toBeDisabled();
    });

    it('explains when the camera is not allowed', async () => {
        cameraPermission.mockResolvedValueOnce({ granted: false });
        await renderCompose();

        await fireEvent.press(screen.getByRole('button', { name: 'Take a photo' }));

        expect(Alert.alert).toHaveBeenCalledWith('Camera access', expect.stringContaining('camera'));
    });
});
