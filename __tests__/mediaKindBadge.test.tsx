import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { FocusedImage, formatDuration } from '../components/TootCard/focusedImage';
import { Attachment } from '../services/mastodon/types';

const media = (type: Attachment['type'], duration?: number): Attachment =>
    ({ id: '1', type, url: 'https://x/m', preview_url: 'https://x/p.jpg', description: undefined, meta: { original: { width: 640, height: 360, duration } } }) as Attachment;

const hidden = { includeHiddenElements: true };

describe('Media kind badges', () => {
    it('marks a video with a play button and its length', async () => {
        await render(<FocusedImage attachment={media('video', 42.4)} />);
        expect(screen.getByTestId('video-badge', hidden)).toBeTruthy();
        expect(screen.getByText('0:42', hidden)).toBeTruthy();
    });

    it('labels a GIF, without a play button', async () => {
        await render(<FocusedImage attachment={media('gifv', 3)} />);
        expect(screen.getByText('GIF', hidden)).toBeTruthy();
        expect(screen.queryByTestId('video-badge', hidden)).toBeNull();
    });

    it('leaves photos and still-veiled media alone', async () => {
        await render(<FocusedImage attachment={media('image')} />);
        expect(screen.queryByTestId('video-badge', hidden)).toBeNull();
        expect(screen.queryByTestId('media-kind-label', hidden)).toBeNull();

        await render(<FocusedImage attachment={media('video', 10)} blurred />);
        expect(screen.queryByTestId('video-badge', hidden)).toBeNull();
    });

    it('keeps a small thumbnail to the play button', async () => {
        await render(<FocusedImage attachment={media('video', 42)} />);
        await fireEvent(screen.getByTestId('focused-image'), 'layout', { nativeEvent: { layout: { width: 80, height: 80 } } });
        expect(screen.getByTestId('video-badge', hidden)).toBeTruthy();
        expect(screen.queryByText('0:42', hidden)).toBeNull();
    });

    it('writes lengths as minutes and seconds', () => {
        expect(formatDuration(5)).toBe('0:05');
        expect(formatDuration(725.6)).toBe('12:06');
    });
});
