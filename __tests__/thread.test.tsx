import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils/queryClient';
import { MediaViewerProvider } from '../components/MediaViewer/mediaViewer';
import Thread, { THREAD_NEWEST_FIRST_KEY, threadRows } from '../screens/Thread/thread';
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
    useTheme: () => jest.requireActual('../testUtils/theme').mockTheme,
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

// A reply to `to`, posted `minute` minutes into the thread
const reply = (id: string, to: string, minute: number): Status => ({
    ...makeStatus(id),
    in_reply_to_id: to,
    created_at: new Date(Date.UTC(2026, 9, 14, 12, minute)).toISOString(),
});

const renderThread = (onStatusPress = jest.fn()) =>
    render(
        <SafeAreaProvider
            initialMetrics={{
                frame: { x: 0, y: 0, width: 390, height: 844 },
                insets: { top: 47, left: 0, right: 0, bottom: 34 },
            }}
        >
            <QueryClientProvider client={createTestQueryClient()}>
                <MediaViewerProvider>
                    <Thread statusId="main" onBack={jest.fn()} onStatusPress={onStatusPress} />
                </MediaViewerProvider>
            </QueryClientProvider>
        </SafeAreaProvider>
    );

describe('threadRows', () => {
    const main = { ...makeStatus('main'), isMain: true };
    const by = (status: Status, username: string): Status => ({ ...status, account: { ...status.account, id: username, username } });

    it('puts each answer to the post first, its whole branch one level in, answers newest first when asked', () => {
        const statuses = [makeStatus('parent'), main, reply('b', 'main', 3), reply('a', 'main', 1), reply('a1', 'a', 2), by(reply('a2', 'a1', 4), 'nina')];
        const rows = (newest: boolean) => threadRows(statuses, newest).map(row => `${row.status.id}:${row.depth}`);
        expect(rows(false)).toEqual(['parent:0', 'main:0', 'a:1', 'a1:2', 'a2:2', 'b:1']);
        expect(rows(true)).toEqual(['parent:0', 'main:0', 'b:1', 'a:1', 'a1:2', 'a2:2']);
    });

    it('says whom a reply deeper in a branch answers', () => {
        const statuses = [main, reply('a', 'main', 1), by(reply('a1', 'a', 2), 'ana'), reply('a2', 'a1', 3)];
        expect(threadRows(statuses, false).map(row => row.replyingTo?.username)).toEqual([undefined, undefined, undefined, 'ana']);
    });

    it('hangs a reply whose parent is gone off the post', () => {
        expect(threadRows([main, reply('orphan', 'deleted', 1)], false).map(row => row.depth)).toEqual([0, 1]);
    });
});

describe('Thread', () => {
    beforeEach(async () => {
        jest.clearAllMocks();
        await AsyncStorage.clear();
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

    it('puts the newest replies first when asked, keeping the post on top, and remembers it', async () => {
        mockedGetContext.mockResolvedValue({ ancestors: [makeStatus('parent')], descendants: [reply('older', 'main', 1), reply('newer', 'main', 2)] });
        await renderThread();
        await screen.findByText(/status parent/);
        const order = () => screen.getAllByText(/^status /).map(node => node.props.children);
        expect(order()).toEqual(['status parent', 'status main', 'status older', 'status newer']);
        expect(screen.getByRole('button', { name: 'Oldest first' })).toBeSelected();

        await fireEvent.press(screen.getByRole('button', { name: 'Newest first' }));

        await waitFor(() => expect(order()).toEqual(['status parent', 'status main', 'status newer', 'status older']));
        await waitFor(async () => expect(await AsyncStorage.getItem(THREAD_NEWEST_FIRST_KEY)).toBe('true'));
    });

    it('opens newest first once that was chosen', async () => {
        await AsyncStorage.setItem(THREAD_NEWEST_FIRST_KEY, 'true');
        await renderThread();

        await waitFor(() => expect(screen.getByRole('button', { name: 'Newest first' })).toBeSelected());
    });

    it('hangs a branch off its first reply\'s avatar, one level in', async () => {
        mockedGetContext.mockResolvedValue({
            ancestors: [makeStatus('parent')],
            descendants: [reply('first', 'main', 1), reply('nested', 'first', 2), reply('deeper', 'nested', 3), reply('second', 'main', 4)],
        });
        await renderThread();
        await screen.findByText(/status second/);
        expect(screen.getAllByTestId('thread-branch')).toHaveLength(2);
        // parent → post, and first → its branch
        expect(screen.getAllByTestId('thread-line-top')).toHaveLength(1);
        expect(screen.getAllByTestId('thread-line-bottom')).toHaveLength(2);
        expect(screen.getByText('Replying to @user')).toBeTruthy();
    });

    it('has no order choice for a lone post', async () => {
        mockedGetContext.mockResolvedValue({ ancestors: [], descendants: [] });
        await renderThread();
        await screen.findByText(/status main/);
        expect(screen.queryByRole('button', { name: 'Newest first' })).toBeNull();
    });

    it('says whose post it is in the header', async () => {
        mockedGetStatus.mockResolvedValue({
            ...makeStatus('main'),
            account: { id: 'a2', username: 'ana', acct: 'ana@pug.social', display_name: 'Ana', avatar: '', emojis: [] },
        });
        await renderThread();

        await screen.findByText('Post by Ana');
        const header = within(screen.getByTestId('thread-header'));
        expect(header.getByText('Post by Ana')).toBeTruthy();
        expect(header.getByText('@ana@pug.social')).toBeTruthy();
    });
});
