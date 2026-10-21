import React from 'react';
import { Platform, Share } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import { File } from 'expo-file-system';
import { SaveMediaButton } from '../components/MediaViewer/saveMediaButton';
import { saveToGallery } from '../services/media/save';
import { dialog } from '../services/dialog';

const mockDelete = jest.fn();
jest.mock('expo-file-system', () => ({
    Paths: { cache: 'file:///cache/' },
    Directory: jest.fn().mockImplementation(() => ({ create: jest.fn() })),
    File: { downloadFileAsync: jest.fn(async () => ({ uri: 'file:///cache/saved-media/v1.mp4', delete: mockDelete })) },
}));
jest.mock('expo-media-library', () => ({
    Asset: { create: jest.fn(async () => ({})) },
    requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
}));
jest.mock('../services/themeContext', () => ({
    useTheme: () => jest.requireActual('../testUtils/theme').mockTheme,
}));

const download = File.downloadFileAsync as jest.Mock;
const create = Asset.create as jest.Mock;
const permission = requestPermissionsAsync as jest.Mock;
const url = 'https://files.example.social/media/original/v1.mp4';

describe('Saving media', () => {
    const os = Platform.OS;
    afterEach(() => {
        Platform.OS = os;
        jest.clearAllMocks();
    });

    it('downloads the original, adds it to the gallery and cleans up', async () => {
        Platform.OS = 'android';
        await saveToGallery(url);
        // Android 11+ needs no permission to add to MediaStore
        expect(permission).not.toHaveBeenCalled();
        expect(download).toHaveBeenCalledWith(url, expect.anything(), { idempotent: true });
        expect(create).toHaveBeenCalledWith('file:///cache/saved-media/v1.mp4');
        expect(mockDelete).toHaveBeenCalled();
    });

    it('asks iOS for add-only access, and stops if it is refused', async () => {
        Platform.OS = 'ios';
        permission.mockResolvedValueOnce({ granted: false });
        await expect(saveToGallery(url)).rejects.toThrow();
        expect(permission).toHaveBeenCalledWith(true);
        expect(download).not.toHaveBeenCalled();
    });

    it('says when it is saved', async () => {
        const toast = jest.spyOn(dialog, 'toast');
        await render(<SaveMediaButton url={url} />);
        await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
        await waitFor(() => expect(toast).toHaveBeenCalledWith('Saved to your phone'));
    });

    it('offers to share the link when saving fails', async () => {
        create.mockRejectedValueOnce(new Error('no storage permission'));
        const alert = jest.spyOn(dialog, 'alert');
        const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
        await render(<SaveMediaButton url={url} />);
        await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(alert).toHaveBeenCalled());
        const [title, , buttons] = alert.mock.calls[0];
        expect(title).toBe("Couldn't save");
        buttons!.find(button => button.text === 'Share link')!.onPress!();
        expect(share).toHaveBeenCalled();
        // The file is cleaned up either way
        expect(mockDelete).toHaveBeenCalled();
    });
});
