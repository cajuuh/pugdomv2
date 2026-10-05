import React from 'react';
import { Alert, Image } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator } from 'expo-image-manipulator';
import { createTestQueryClient } from '../testUtils/queryClient';
import apiClient from '../services/api/client';
import {
    centeredCrop,
    cropPixels,
    cropRatio,
    fitSize,
    flipHorizontal,
    ImageEdits,
    isEdited,
    moveCrop,
    NO_EDITS,
    orientedSize,
    resizeCrop,
    rotateClockwise,
    sameEdits,
} from '../services/media/geometry';
import { applyEdits } from '../services/media/edit';
import { PickedImage } from '../services/media/prepare';
import { ImageEditor } from '../components/ImageEditor/imageEditor';
import ComposeModal from '../components/ComposeModal/composeModal';
import { createStatus } from '../services/mastodon/statuses';
import { Account, Status } from '../services/mastodon/types';

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
jest.mock('../services/mastodon/statuses', () => ({ createStatus: jest.fn() }));
jest.mock('../services/mastodon/customEmojis', () => ({ fetchCustomEmojis: jest.fn(async () => []) }));

const api = apiClient as unknown as Record<'get' | 'post' | 'put', jest.Mock>;
const manipulate = ImageManipulator.manipulate as jest.Mock;
// The mocked manipulator hands back one context for every call
const context = () => manipulate.mock.results[0]?.value ?? manipulate('probe');

const photo = (name: string, extra: Partial<PickedImage> = {}): PickedImage => ({
    uri: `file:///photos/${name}`,
    width: 1000,
    height: 800,
    mimeType: 'image/jpeg',
    fileName: name,
    ...extra,
});
const crop = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });
const close = (rect: { x: number; y: number; width: number; height: number }, expected: typeof rect) =>
    (Object.keys(expected) as (keyof typeof rect)[]).forEach(side => expect(rect[side]).toBeCloseTo(expected[side], 5));

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    // The same size the picker reported
    jest.spyOn(Image, 'getSize').mockImplementation((async () => ({ width: 1000, height: 800 })) as typeof Image.getSize);
});
afterEach(() => jest.restoreAllMocks());

describe('crop geometry', () => {
    it('turns the crop with the image, back to where it started after four turns', () => {
        const edits: ImageEdits = { ...NO_EDITS, crop: crop(0.1, 0.2, 0.3, 0.4) };
        const turned = rotateClockwise(edits);

        expect(turned.rotation).toBe(90);
        close(turned.crop, crop(0.4, 0.1, 0.4, 0.3));
        const full = rotateClockwise(rotateClockwise(rotateClockwise(turned)));
        expect(full.rotation).toBe(0);
        close(full.crop, edits.crop);
    });

    it('turns a mirrored image the other way underneath, so it still turns clockwise on screen', () => {
        expect(rotateClockwise({ ...NO_EDITS, flipped: true }).rotation).toBe(270);
        expect(rotateClockwise({ ...NO_EDITS, rotation: 270, flipped: true }).rotation).toBe(180);
    });

    it('mirrors the crop, and a second flip undoes the first', () => {
        const edits: ImageEdits = { ...NO_EDITS, crop: crop(0.1, 0.2, 0.3, 0.4) };
        close(flipHorizontal(edits).crop, crop(0.6, 0.2, 0.3, 0.4));
        expect(sameEdits(flipHorizontal(flipHorizontal(edits)), edits)).toBe(true);
    });

    it('moves the crop without leaving the image', () => {
        close(moveCrop(crop(0.2, 0.2, 0.5, 0.5), 0.1, -0.1), crop(0.3, 0.1, 0.5, 0.5));
        close(moveCrop(crop(0.2, 0.2, 0.5, 0.5), 0.9, -0.9), crop(0.5, 0, 0.5, 0.5));
    });

    it('resizes from a corner, keeping the opposite corner, the edges and a minimum size', () => {
        const options = { minWidth: 0.1, minHeight: 0.1 };
        close(resizeCrop(crop(0, 0, 1, 1), 'topLeft', 0.2, 0.3, options), crop(0.2, 0.3, 0.8, 0.7));
        close(resizeCrop(crop(0.2, 0.2, 0.5, 0.5), 'bottomRight', 0.9, 0.1, options), crop(0.2, 0.2, 0.8, 0.6));
        // Dragged past the opposite corner: stops at the minimum
        close(resizeCrop(crop(0.2, 0.2, 0.5, 0.5), 'topRight', -0.9, 0.9, options), crop(0.2, 0.6, 0.1, 0.1));
    });

    it('keeps a locked shape while resizing', () => {
        const options = { minWidth: 0.1, minHeight: 0.1, ratio: 1 };
        const resized = resizeCrop(crop(0, 0, 0.5, 0.5), 'bottomRight', 0.3, 0.1, options);

        close(resized, crop(0, 0, 0.8, 0.8));
        // The room runs out on one side first
        close(resizeCrop(crop(0, 0.5, 0.4, 0.4), 'bottomRight', 0.5, 0, options), crop(0, 0.5, 0.5, 0.5));
    });

    it('starts a locked crop as large as fits, centered', () => {
        // A 3:1 header on a 1000×800 image: full width, a third of 1000 tall
        close(centeredCrop(cropRatio(3, { width: 1000, height: 800 })), crop(0, (1 - 1000 / 3 / 800) / 2, 1, 1000 / 3 / 800));
        // A square avatar on the same image: full height
        close(centeredCrop(cropRatio(1, { width: 1000, height: 800 })), crop(0.1, 0, 0.8, 1));
    });

    it('converts to whole pixels inside the image', () => {
        expect(cropPixels(crop(0.25, 0.5, 0.5, 0.6), { width: 1000, height: 800 })).toEqual({ originX: 250, originY: 400, width: 500, height: 400 });
    });

    it('sizes the image for the screen', () => {
        expect(orientedSize({ width: 1000, height: 800 }, 90)).toEqual({ width: 800, height: 1000 });
        expect(fitSize({ width: 400, height: 400 }, { width: 1000, height: 800 })).toEqual({ width: 400, height: 320 });
        expect(isEdited(NO_EDITS)).toBe(false);
        expect(isEdited({ ...NO_EDITS, crop: crop(0, 0, 0.9, 1) })).toBe(true);
    });
});

describe('applying edits', () => {
    it('leaves an unedited image alone', async () => {
        const image = photo('a.jpg');
        expect(await applyEdits(image, NO_EDITS)).toBe(image);
        expect(manipulate).not.toHaveBeenCalled();
    });

    it('turns, mirrors, then crops in the rendered pixels', async () => {
        const edited = await applyEdits(photo('a.jpg'), { rotation: 90, flipped: true, crop: crop(0.5, 0, 0.5, 1) });
        const steps = context();

        expect(steps.rotate).toHaveBeenCalledWith(90);
        expect(steps.flip).toHaveBeenCalledWith('horizontal');
        // The mocked render is 1000×800
        expect(steps.crop).toHaveBeenCalledWith({ originX: 500, originY: 0, width: 500, height: 800 });
        expect(edited).toMatchObject({ uri: 'file:///cache/converted.jpg', mimeType: 'image/jpeg', fileName: 'a.jpg' });
    });

    it('keeps PNGs as PNG', async () => {
        const edited = await applyEdits(photo('logo.png', { mimeType: 'image/png' }), { ...NO_EDITS, rotation: 180 });
        expect(edited).toMatchObject({ mimeType: 'image/png', fileName: 'logo.png' });
        expect(context().crop).not.toHaveBeenCalled();
    });
});

describe('Image editor', () => {
    const renderEditor = async (props: Partial<React.ComponentProps<typeof ImageEditor>> = {}) => {
        const onDone = jest.fn();
        await render(<ImageEditor visible image={photo('a.jpg')} onCancel={jest.fn()} onDone={onDone} {...props} />);
        await fireEvent(screen.getByTestId('image-editor-stage'), 'layout', { nativeEvent: { layout: { width: 488, height: 488 } } });
        return onDone;
    };

    it('shows the crop over the whole image, ready to drag', async () => {
        await renderEditor();

        expect(screen.getByLabelText('Crop')).toBeTruthy();
        expect(screen.getByLabelText('Top left corner of the crop')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
    });

    it('rotates and flips, then hands back the edits', async () => {
        const onDone = await renderEditor();

        await fireEvent.press(screen.getByRole('button', { name: 'Rotate' }));
        await fireEvent.press(screen.getByRole('button', { name: 'Flip' }));
        expect(screen.getByRole('button', { name: 'Reset' })).toBeEnabled();
        await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

        expect(onDone).toHaveBeenCalledWith({ rotation: 90, flipped: true, crop: { x: 0, y: 0, width: 1, height: 1 } });
    });

    it('starts again from the earlier edits, and resets them', async () => {
        const onDone = await renderEditor({ initialEdits: { rotation: 180, flipped: false, crop: crop(0.1, 0.1, 0.5, 0.5) } });

        await fireEvent.press(screen.getByRole('button', { name: 'Reset' }));
        await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

        expect(onDone).toHaveBeenCalledWith(NO_EDITS);
    });

    it('locks the crop to a shape for avatars and headers', async () => {
        const onDone = await renderEditor({ aspect: 1 });

        await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

        const [edits] = onDone.mock.calls[0];
        close(edits.crop, crop(0.1, 0, 0.8, 1));
    });
});

describe('Editing in compose', () => {
    const library = ImagePicker.launchImageLibraryAsync as jest.Mock;

    beforeEach(() => {
        (createStatus as jest.Mock).mockResolvedValue({} as Status);
        api.get.mockResolvedValue({ data: {} });
        let next = 0;
        api.post.mockImplementation(async () => ({ status: 200, data: { id: `m${++next}`, type: 'image', url: 'https://home.social/m.jpg', preview_url: '' } }));
        api.put.mockResolvedValue({ data: {} });
    });

    const renderCompose = async (...images: PickedImage[]) => {
        await render(
            <QueryClientProvider client={createTestQueryClient()}>
                <ComposeModal isOpen replyToStatus={null} closeCompose={jest.fn()} />
            </QueryClientProvider>
        );
        library.mockResolvedValueOnce({ canceled: false, assets: images });
        await fireEvent.press(screen.getByRole('button', { name: 'Add images' }));
        await waitFor(() => expect(screen.getByRole('button', { name: 'Post' })).toBeEnabled());
    };

    it('uploads the edited image in place of the first, keeping its description', async () => {
        await renderCompose(photo('a.jpg'));
        await fireEvent.press(screen.getByRole('button', { name: 'Describe image 1' }));
        await fireEvent.changeText(screen.getByLabelText('Description'), 'A pug');
        await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

        await fireEvent.press(screen.getByRole('button', { name: 'Edit image 1' }));
        await fireEvent(screen.getByTestId('image-editor-stage'), 'layout', { nativeEvent: { layout: { width: 488, height: 488 } } });
        await fireEvent.press(screen.getByRole('button', { name: 'Rotate' }));
        await fireEvent.press(screen.getAllByRole('button', { name: 'Done' }).at(-1)!);

        await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
        expect(context().rotate).toHaveBeenCalledWith(90);
        expect(screen.queryByLabelText('Crop')).toBeNull();
        await waitFor(() => expect(screen.getByRole('button', { name: 'Post' })).toBeEnabled());
        await fireEvent.press(screen.getByRole('button', { name: 'Post' }));

        await waitFor(() => expect(createStatus).toHaveBeenCalledWith(expect.objectContaining({ media_ids: ['m2'] })));
        expect(api.put).toHaveBeenCalledWith('/media/m2', { description: 'A pug' });
    });

    it('leaves the upload alone when nothing changed', async () => {
        await renderCompose(photo('a.jpg'));

        await fireEvent.press(screen.getByRole('button', { name: 'Edit image 1' }));
        await fireEvent.press(screen.getAllByRole('button', { name: 'Done' }).at(-1)!);

        expect(api.post).toHaveBeenCalledTimes(1);
        expect(manipulate).not.toHaveBeenCalled();
    });

    it("doesn't offer to edit GIFs", async () => {
        await renderCompose(photo('cat.gif', { mimeType: 'image/gif' }));

        expect(screen.getByRole('button', { name: 'Describe image 1' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Edit image 1' })).toBeNull();
    });
});
