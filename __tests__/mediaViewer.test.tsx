import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { useVideoPlayer } from 'expo-video';
import * as WebBrowser from 'expo-web-browser';
import RenderHtml from 'react-native-render-html';
import { TootCard } from '../components/TootCard/tootCard';
import { MediaViewerProvider, useMediaViewer } from '../components/MediaViewer/mediaViewer';
import { favouriteStatus } from '../services/mastodon/statuses';
import { Attachment, Status } from '../services/mastodon/types';
import { createTestQueryClient } from '../testUtils/queryClient';

// An observable stand-in for the native video player
jest.mock('expo-video', () => {
    const { Text } = require('react-native');
    return {
        useVideoPlayer: jest.fn((source: string, setup?: (player: any) => void) => {
            const player = { source, loop: false, playing: false, duration: 0, currentTime: 0, play: jest.fn(), pause: jest.fn(), replay: jest.fn(), seekBy: jest.fn(), addListener: jest.fn(() => ({ remove: jest.fn() })) };
            setup?.(player);
            return player;
        }),
        VideoView: ({ player }: any) => <Text>{`playing ${player.source} loop=${player.loop}`}</Text>,
    };
});

jest.mock('expo-web-browser', () => ({
    openBrowserAsync: jest.fn(async () => ({})),
    maybeCompleteAuthSession: jest.fn(),
}));

// Counts how often a post's HTML is rendered
jest.mock('react-native-render-html', () => {
    const { Text } = require('react-native');
    return {
        __esModule: true,
        default: jest.fn(({ source }: any) => <Text>{source.html}</Text>),
        HTMLElementModel: { fromCustomModel: (model: any) => model },
        HTMLContentModel: { textual: 'textual' },
        defaultSystemFonts: [],
    };
});

jest.mock('../services/mastodon/statuses', () => ({
    favouriteStatus: jest.fn(),
    unfavouriteStatus: jest.fn(),
    reblogStatus: jest.fn(),
    unreblogStatus: jest.fn(),
}));
jest.mock('../services/settingsContext', () => ({ useOptionalSettings: () => null,
    useSettings: () => ({ compactMode: false, mediaAutoplay: false }),
}));
jest.mock('../services/themeContext', () => ({
    useTheme: () => jest.requireActual('../testUtils/theme').mockTheme,
}));
jest.mock('../services/composeContext', () => ({
    useCompose: () => ({ openCompose: jest.fn() }),
}));

const attachment = (id: string, type: Attachment['type'], description?: string): Attachment => ({
    id,
    type,
    url: `https://files.example.social/${id}`,
    preview_url: `https://files.example.social/${id}-small`,
    description,
});

const makeStatus = (id: string, media: Attachment[] = []): Status => ({
    id,
    created_at: new Date().toISOString(),
    in_reply_to_id: null,
    in_reply_to_account_id: null,
    sensitive: false,
    spoiler_text: '',
    visibility: 'public',
    language: 'en',
    uri: `https://example.social/statuses/${id}`,
    url: `https://example.social/@user/${id}`,
    replies_count: 0,
    reblogs_count: 0,
    favourites_count: 7,
    content: `<p>status ${id}</p>`,
    reblog: null,
    account: { id: 'a1', username: 'user', acct: 'user', display_name: 'User', avatar: '', emojis: [] },
    media_attachments: media,
    emojis: [],
    favourited: false,
    reblogged: false,
});

const renderCards = (...statuses: Status[]) =>
    render(
        <QueryClientProvider client={createTestQueryClient()}>
            <MediaViewerProvider>
                {statuses.map(status => <TootCard key={status.id} status={status} />)}
            </MediaViewerProvider>
        </QueryClientProvider>
    );

describe('shared media viewer', () => {
    beforeEach(() => jest.clearAllMocks());

    it('does not create a video player per card', async () => {
        await renderCards(
            makeStatus('1', [attachment('v1', 'video')]),
            makeStatus('2', [attachment('v2', 'gifv')]),
            makeStatus('3', [attachment('i1', 'image')]),
        );

        expect(useVideoPlayer).not.toHaveBeenCalled();
    });

    it('opens the gallery with only the images, at the tapped image', async () => {
        await renderCards(makeStatus('1', [attachment('i1', 'image'), attachment('v1', 'video'), attachment('i2', 'image')]));

        await fireEvent.press(screen.getByLabelText('Image 3 of 3'));

        // The video is left out of the gallery, which opens on the tapped image (the second of two)
        expect(screen.getByText('2 / 2')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Previous image' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Next image' })).toBeNull();
    });

    describe('opened with a way to the post (the profile media grid)', () => {
        const OpenProbe = ({ media, onOpenPost }: { media: Attachment[]; onOpenPost: () => void }) => {
            const { openMedia } = useMediaViewer();
            return (
                <Pressable accessibilityRole="button" onPress={() => openMedia(media, 0, onOpenPost)}>
                    <Text>open</Text>
                </Pressable>
            );
        };

        it.each([
            ['images', [attachment('i1', 'image')]],
            ['a video', [attachment('v1', 'video')]],
        ])('offers to view the post from %s, closing the viewer', async (_, media) => {
            const onOpenPost = jest.fn();
            await render(
                <MediaViewerProvider>
                    <OpenProbe media={media} onOpenPost={onOpenPost} />
                </MediaViewerProvider>
            );
            await fireEvent.press(screen.getByRole('button', { name: 'open' }));

            await fireEvent.press(screen.getByRole('button', { name: 'View post' }));

            expect(onOpenPost).toHaveBeenCalledTimes(1);
            expect(screen.queryByRole('button', { name: 'View post' })).toBeNull();
        });

        it('leaves it out when opened from a post', async () => {
            await renderCards(makeStatus('1', [attachment('i1', 'image')]));
            await fireEvent.press(screen.getByLabelText('Image 1 of 1'));

            expect(screen.queryByRole('button', { name: 'View post' })).toBeNull();
        });
    });

    it("closes the gallery from its own close button, below the status bar", async () => {
        await renderCards(makeStatus('1', [attachment('i1', 'image')]));
        await fireEvent.press(screen.getByLabelText('Image 1 of 1'));

        await fireEvent.press(screen.getByRole('button', { name: 'Close' }));

        expect(screen.queryByText(/^gallery/)).toBeNull();
    });

    it('plays a video in the shared player and closes it', async () => {
        await renderCards(makeStatus('1', [attachment('i1', 'image'), attachment('v1', 'video')]));

        await fireEvent.press(screen.getByLabelText('Video 2 of 2'));
        expect(screen.getByText('playing https://files.example.social/v1 loop=false')).toBeTruthy();

        await fireEvent.press(screen.getByLabelText('Close video'));
        expect(screen.queryByText(/playing/)).toBeNull();
    });

    it('keeps the audio pitch when the speed changes', async () => {
        await renderCards(makeStatus('1', [attachment('v1', 'video')]));

        await fireEvent.press(screen.getByLabelText('Video 1 of 1'));

        expect((useVideoPlayer as jest.Mock).mock.results.at(-1)?.value.preservesPitch).toBe(true);
    });

    it('loops gifv attachments', async () => {
        await renderCards(makeStatus('1', [attachment('g1', 'gifv')]));

        await fireEvent.press(screen.getByLabelText('GIF 1 of 1'));

        expect(screen.getByText('playing https://files.example.social/g1 loop=true')).toBeTruthy();
    });

    it('shows audio as a playable tile, not a picture, and plays it in the viewer', async () => {
        const audio = { ...attachment('a1', 'audio'), meta: { original: { duration: 192 } } };
        await renderCards(makeStatus('1', [audio]));

        expect(screen.getByTestId('audio-tile')).toBeTruthy();
        expect(screen.queryByTestId('focused-image')).toBeNull();
        expect(screen.getByText('Audio · 3:12', { includeHiddenElements: true })).toBeTruthy();

        await fireEvent.press(screen.getByLabelText('Audio, 3:12 1 of 1'));
        const player = (useVideoPlayer as jest.Mock).mock.results.at(-1)?.value;
        expect(player.source).toBe('https://files.example.social/a1');
        expect(player.play).toHaveBeenCalled();
        // Its own controls, always on screen, with the length from the post until the file loads
        expect(screen.getByTestId('audio-controls')).toBeTruthy();
        expect(screen.getByText('0:00 / 3:12')).toBeTruthy();
        expect(screen.queryByLabelText('Save')).toBeNull();

        await fireEvent.press(screen.getByRole('button', { name: 'Forward 15 s' }));
        expect(player.seekBy).toHaveBeenCalledWith(15);
        await fireEvent.press(screen.getByRole('button', { name: 'Back 15 s' }));
        expect(player.seekBy).toHaveBeenCalledWith(-15);
        await fireEvent.press(screen.getByRole('button', { name: 'Play' }));
        expect(player.play).toHaveBeenCalledTimes(2);

        await fireEvent.press(screen.getByLabelText('Close'));
        expect(screen.queryByTestId('audio-controls')).toBeNull();
    });

    it("keeps the audio badge off a sensitive post's veil", async () => {
        await renderCards({ ...makeStatus('1', [attachment('a1', 'audio')]), sensitive: true });

        expect(screen.getByTestId('audio-tile', { includeHiddenElements: true })).toBeTruthy();
        expect(screen.queryByTestId('audio-badge', { includeHiddenElements: true })).toBeNull();
    });

    it('uses alt text as the accessibility label', async () => {
        await renderCards(makeStatus('1', [attachment('i1', 'image', 'A pug in a raincoat')]));

        expect(screen.getByLabelText('A pug in a raincoat')).toBeTruthy();
    });

    it("says when our server didn't keep the media, and opens the post where it lives", async () => {
        await renderCards(makeStatus('1', [attachment('u1', 'unknown')]));

        expect(screen.getByTestId('media-unavailable')).toBeTruthy();
        expect(screen.getByText('Not available on your server')).toBeTruthy();
        await fireEvent.press(screen.getByLabelText('Attachment 1 of 1'));

        // Not our server's copy of the file, which is gone (a 404)
        expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://example.social/@user/1');
        expect(screen.queryByText(/gallery|playing/)).toBeNull();
    });

    it("opens the original file of unavailable media when there's no post to open", async () => {
        let open: ReturnType<typeof useMediaViewer>['openMedia'] = () => {};
        const Grab = () => {
            open = useMediaViewer().openMedia;
            return null;
        };
        await render(<MediaViewerProvider><Grab /></MediaViewerProvider>);

        open([{ ...attachment('u2', 'unknown'), remote_url: 'https://other.social/files/u2.png' }], 0);

        expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://other.social/files/u2.png');
    });
});

describe('post HTML rendering', () => {
    beforeEach(() => jest.clearAllMocks());

    it('does not re-render the post HTML when the card re-renders', async () => {
        const status = makeStatus('1');
        (favouriteStatus as jest.Mock).mockResolvedValue({ ...status, favourited: true, favourites_count: 8 });
        await renderCards(status);
        const rendersBefore = (RenderHtml as unknown as jest.Mock).mock.calls.length;

        await fireEvent.press(screen.getByText('7'));

        expect(screen.getByText('8')).toBeTruthy();
        expect((RenderHtml as unknown as jest.Mock).mock.calls.length).toBe(rendersBefore);
    });
});
