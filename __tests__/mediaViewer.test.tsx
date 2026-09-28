import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { useVideoPlayer } from 'expo-video';
import * as WebBrowser from 'expo-web-browser';
import RenderHtml from 'react-native-render-html';
import { TootCard } from '../components/TootCard/tootCard';
import { MediaViewerProvider } from '../components/MediaViewer/mediaViewer';
import { favouriteStatus } from '../services/mastodon/statuses';
import { Attachment, Status } from '../services/mastodon/types';
import { createTestQueryClient } from '../testUtils/queryClient';

// Observable stand-ins for the native viewers
jest.mock('react-native-image-viewing', () => {
    const { Text } = require('react-native');
    return ({ visible, images, imageIndex }: any) =>
        visible ? <Text>{`gallery ${imageIndex}: ${images.map((image: any) => image.uri).join(', ')}`}</Text> : null;
});

jest.mock('expo-video', () => {
    const { Text } = require('react-native');
    return {
        useVideoPlayer: jest.fn((source: string, setup?: (player: any) => void) => {
            const player = { source, loop: false, play: jest.fn(), pause: jest.fn() };
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
    };
});

jest.mock('../services/mastodon/statuses', () => ({
    favouriteStatus: jest.fn(),
    unfavouriteStatus: jest.fn(),
    reblogStatus: jest.fn(),
    unreblogStatus: jest.fn(),
}));
jest.mock('../services/settingsContext', () => ({
    useSettings: () => ({ compactMode: false, mediaAutoplay: false }),
}));
jest.mock('../services/themeContext', () => ({
    useTheme: () => ({ colors: jest.requireActual('../services/themeContext').lightColors, isDark: false }),
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

        expect(screen.getByText('gallery 1: https://files.example.social/i1, https://files.example.social/i2')).toBeTruthy();
    });

    it('plays a video in the shared player and closes it', async () => {
        await renderCards(makeStatus('1', [attachment('i1', 'image'), attachment('v1', 'video')]));

        await fireEvent.press(screen.getByLabelText('Video 2 of 2'));
        expect(screen.getByText('playing https://files.example.social/v1 loop=false')).toBeTruthy();

        await fireEvent.press(screen.getByLabelText('Close video'));
        expect(screen.queryByText(/playing/)).toBeNull();
    });

    it('loops gifv attachments', async () => {
        await renderCards(makeStatus('1', [attachment('g1', 'gifv')]));

        await fireEvent.press(screen.getByLabelText('GIF 1 of 1'));

        expect(screen.getByText('playing https://files.example.social/g1 loop=true')).toBeTruthy();
    });

    it('uses alt text as the accessibility label', async () => {
        await renderCards(makeStatus('1', [attachment('i1', 'image', 'A pug in a raincoat')]));

        expect(screen.getByLabelText('A pug in a raincoat')).toBeTruthy();
    });

    it('opens unknown media types in the browser', async () => {
        await renderCards(makeStatus('1', [attachment('u1', 'unknown')]));

        await fireEvent.press(screen.getByLabelText('Attachment 1 of 1'));

        expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://files.example.social/u1');
        expect(screen.queryByText(/gallery|playing/)).toBeNull();
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
