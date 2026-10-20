import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { File } from 'expo-file-system';
import { ImageGallery } from '../components/MediaViewer/imageGallery';

jest.mock('../services/themeContext', () => ({
    useTheme: () => jest.requireActual('../testUtils/theme').mockTheme,
}));

const images = [{ uri: 'https://x/1.jpg' }, { uri: 'https://x/2.jpg', description: 'A pug' }];

describe('ImageGallery', () => {
    it('closes when an image is dragged down far enough', async () => {
        const onClose = jest.fn();
        await render(<ImageGallery images={[images[0]]} index={0} visible onClose={onClose} />);

        fireGestureHandler(getByGestureTestId('gallery-dismiss'), [
            { state: State.BEGAN, translationY: 0 },
            { state: State.ACTIVE, translationY: 60 },
            { state: State.END, translationY: 200, velocityY: 0 },
        ]);

        expect(onClose).toHaveBeenCalled();
    });

    it('stays open after a short drag', async () => {
        const onClose = jest.fn();
        await render(<ImageGallery images={[images[0]]} index={0} visible onClose={onClose} />);

        fireGestureHandler(getByGestureTestId('gallery-dismiss'), [
            { state: State.BEGAN, translationY: 0 },
            { state: State.ACTIVE, translationY: 30 },
            { state: State.END, translationY: 40, velocityY: 100 },
        ]);

        expect(onClose).not.toHaveBeenCalled();
    });

    it('counts, labels and steps through the images', async () => {
        await render(<ImageGallery images={images} index={0} visible onClose={jest.fn()} />);

        expect(screen.getByText('1 / 2')).toBeTruthy();
        expect(screen.getByLabelText('A pug')).toBeTruthy();
        await fireEvent.press(screen.getByRole('button', { name: 'Next image' }));
        expect(screen.getByText('2 / 2')).toBeTruthy();
    });

    it('saves the image being looked at', async () => {
        await render(<ImageGallery images={images} index={1} visible onClose={jest.fn()} />);
        await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
        expect(File.downloadFileAsync).toHaveBeenCalledWith('https://x/2.jpg', expect.anything(), { idempotent: true });
    });

    it('closes from its close button', async () => {
        const onClose = jest.fn();
        await render(<ImageGallery images={images} index={0} visible onClose={onClose} />);
        await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
        expect(onClose).toHaveBeenCalled();
    });
});
