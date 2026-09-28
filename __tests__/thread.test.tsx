import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Thread from '../screens/Thread/thread';
import { getStatus, getStatusContext } from '../services/mastodon/statuses';
import { Status } from '../services/mastodon/types';

jest.mock('../services/mastodon/statuses', () => ({
    getStatus: jest.fn(),
    getStatusContext: jest.fn(),
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

const mockedGetStatus = getStatus as jest.MockedFunction<typeof getStatus>;
const mockedGetContext = getStatusContext as jest.MockedFunction<typeof getStatusContext>;

const makeStatus = (id: string): Status => ({
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
    favourites_count: 0,
    content: `<p>status ${id}</p>`,
    reblog: null,
    account: { id: 'a1', username: 'user', acct: 'user', display_name: 'User', avatar: '', emojis: [] },
    media_attachments: [],
    emojis: [],
});

const renderThread = (onStatusPress = jest.fn()) =>
    render(
        <SafeAreaProvider
            initialMetrics={{
                frame: { x: 0, y: 0, width: 390, height: 844 },
                insets: { top: 47, left: 0, right: 0, bottom: 34 },
            }}
        >
            <QueryClientProvider client={new QueryClient()}>
                <Thread statusId="main" onBack={jest.fn()} onStatusPress={onStatusPress} />
            </QueryClientProvider>
        </SafeAreaProvider>
    );

describe('Thread', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedGetStatus.mockResolvedValue(makeStatus('main'));
        mockedGetContext.mockResolvedValue({ ancestors: [makeStatus('parent')], descendants: [makeStatus('reply')] });
    });

    it('pads the header by the top safe-area inset', async () => {
        await renderThread();

        const header = StyleSheet.flatten(screen.getByTestId('thread-header').props.style);
        expect(header.paddingTop).toBe(47 + 10);
    });

    it('shows ancestors, the status and replies, and opens the pressed status', async () => {
        const onStatusPress = jest.fn();
        await renderThread(onStatusPress);

        expect(await screen.findByText(/status parent/)).toBeTruthy();
        expect(screen.getByText(/status main/)).toBeTruthy();
        expect(screen.getByText(/status reply/)).toBeTruthy();

        await fireEvent.press(screen.getByText(/status reply/));
        expect(onStatusPress).toHaveBeenCalledWith('reply');
    });
});
