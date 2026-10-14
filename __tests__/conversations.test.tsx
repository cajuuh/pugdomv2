import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils/queryClient';
import apiClient from '../services/api/client';
import { Conversation, getConversations, groupConversations } from '../services/mastodon/conversations';
import { unreadConversationsKey } from '../hooks/useUnreadConversations';
import Conversations from '../screens/Conversations/conversations';
import ConversationGroupScreen from '../screens/Conversations/conversationGroup';
import { Account, Status } from '../services/mastodon/types';
import { dialog } from '../services/dialog';

jest.mock('../services/api/client', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
jest.mock('../services/themeContext', () => ({
    useTheme: () => jest.requireActual('../testUtils/theme').mockTheme,
}));
jest.mock('../services/authContext', () => ({ useOptionalAuth: () => ({ user: { id: 'me' } }), useAuth: () => ({ user: { id: 'me' } }) }));

const mockedGet = apiClient.get as jest.Mock;
const mockedPost = apiClient.post as jest.Mock;

const account = (id: string, name: string): Account => ({ id, username: id, acct: id, display_name: name, avatar: '', emojis: [] });
const ana = account('ana', 'Ana');
const bruno = account('bruno', 'Bruno');
const me = account('me', 'Me');
const post = (id: string, author: Account, content: string, extra: Partial<Status> = {}) =>
    ({ id, account: author, content, spoiler_text: '', created_at: new Date().toISOString(), visibility: 'direct', ...extra }) as Status;
const conversation = (id: string, accounts: Account[], last: Status, unread = false): Conversation => ({ id, accounts, last_status: last, unread });

beforeEach(() => jest.clearAllMocks());

describe('getConversations', () => {
    it('pages with the Link header', async () => {
        mockedGet.mockResolvedValue({ data: [], headers: { link: '<https://home.social/api/v1/conversations?max_id=42>; rel="next"' } });

        await expect(getConversations()).resolves.toEqual({ conversations: [], nextMaxId: '42' });
        expect(mockedGet).toHaveBeenCalledWith('/conversations', { params: { max_id: undefined } });
    });
});

describe('Conversations', () => {
    let queryClient: QueryClient;
    const onStatusPress = jest.fn();
    const onGroupPress = jest.fn();

    const renderScreen = async (conversations: Conversation[]) => {
        mockedGet.mockResolvedValue({ data: conversations, headers: {} });
        queryClient = createTestQueryClient();
        await render(
            <QueryClientProvider client={queryClient}>
                <Conversations onBack={jest.fn()} onStatusPress={onStatusPress} onGroupPress={onGroupPress} />
            </QueryClientProvider>
        );
    };

    it('puts every thread with the same people in one row, and opens their threads', async () => {
        await renderScreen([
            conversation('c1', [ana], post('s1', ana, '<p>de novo</p>'), true),
            conversation('c2', [bruno], post('s2', bruno, '<p>oi</p>')),
            conversation('c3', [ana], post('s3', ana, '<p>primeira</p>')),
        ]);

        const row = await screen.findByRole('button', { name: 'Ana. 2 conversations. Unread. de novo' });
        expect(screen.getByText('2 conversations')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Bruno. oi' })).toBeTruthy();

        await fireEvent.press(row);
        expect(onGroupPress).toHaveBeenCalledWith('ana');
        expect(onStatusPress).not.toHaveBeenCalled();
    });

    it('lists who each conversation is with and its last message', async () => {
        await renderScreen([
            conversation('c1', [ana], post('s1', ana, '<p>oi! viu o post?</p>'), true),
            conversation('c2', [bruno, ana], post('s2', me, '<p>combinado</p>')),
            conversation('c3', [bruno], post('s3', bruno, '<p>hidden</p>', { spoiler_text: 'spoilers' })),
        ]);

        expect(await screen.findByRole('button', { name: 'Ana. Unread. oi! viu o post?' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Bruno, Ana. You: combinado' })).toBeTruthy();
        // A content warning stands in for the text it hides
        expect(screen.getByRole('button', { name: 'Bruno. ⚠ spoilers' })).toBeTruthy();
        expect(screen.getAllByTestId('conversation-unread')).toHaveLength(1);
    });

    it('marks an unread conversation read, refreshes the envelope and opens its thread', async () => {
        mockedPost.mockResolvedValue({ data: {} });
        await renderScreen([conversation('c1', [ana], post('s1', ana, '<p>oi</p>'), true)]);
        queryClient.setQueryData(unreadConversationsKey('me'), true);

        await fireEvent.press(await screen.findByRole('button', { name: 'Ana. Unread. oi' }));

        expect(onStatusPress).toHaveBeenCalledWith('s1');
        expect(mockedPost).toHaveBeenCalledWith('/conversations/c1/read');
        await waitFor(() => expect(screen.queryByTestId('conversation-unread')).toBeNull());
        await waitFor(() => expect(queryClient.getQueryState(unreadConversationsKey('me'))?.isInvalidated).toBe(true));
    });

    it('lists only unread conversations on Unread', async () => {
        await renderScreen([
            conversation('c1', [ana], post('s1', ana, '<p>oi</p>'), true),
            conversation('c2', [bruno], post('s2', bruno, '<p>tchau</p>')),
        ]);
        await screen.findByRole('button', { name: 'Bruno. tchau' });

        await fireEvent.press(screen.getByRole('button', { name: 'Unread' }));

        expect(screen.getByRole('button', { name: 'Ana. Unread. oi' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Bruno. tchau' })).toBeNull();
    });

    it('says when nothing is unread, without offering to mark all read', async () => {
        await renderScreen([conversation('c2', [bruno], post('s2', bruno, '<p>tchau</p>'))]);
        await screen.findByRole('button', { name: 'Bruno. tchau' });
        expect(screen.queryByRole('button', { name: 'Mark all as read' })).toBeNull();

        await fireEvent.press(screen.getByRole('button', { name: 'Unread' }));
        expect(screen.getByText('No unread messages')).toBeTruthy();
    });

    it('marks every unread conversation read and refreshes the envelope', async () => {
        mockedPost.mockResolvedValue({ data: {} });
        await renderScreen([
            conversation('c1', [ana], post('s1', ana, '<p>oi</p>'), true),
            conversation('c2', [bruno], post('s2', bruno, '<p>tchau</p>')),
            conversation('c3', [bruno, ana], post('s3', bruno, '<p>olá</p>'), true),
        ]);
        queryClient.setQueryData(unreadConversationsKey('me'), true);

        await fireEvent.press(await screen.findByRole('button', { name: 'Mark all as read' }));

        expect(mockedPost.mock.calls.map(call => call[0])).toEqual(['/conversations/c1/read', '/conversations/c3/read']);
        await waitFor(() => expect(screen.queryByTestId('conversation-unread')).toBeNull());
        expect(screen.queryByRole('button', { name: 'Mark all as read' })).toBeNull();
        await waitFor(() => expect(queryClient.getQueryState(unreadConversationsKey('me'))?.isInvalidated).toBe(true));
    });

    it('keeps the ones that worked read and brings back the dot on the ones that failed', async () => {
        const toast = jest.spyOn(dialog, 'toast').mockImplementation(() => {});
        mockedPost.mockImplementation((url: string) =>
            url === '/conversations/c2/read' ? Promise.reject(Object.assign(new Error('Server error'), { response: { status: 500 } })) : Promise.resolve({ data: {} })
        );
        await renderScreen([
            conversation('c1', [ana], post('s1', ana, '<p>oi</p>'), true),
            conversation('c2', [bruno], post('s2', bruno, '<p>tchau</p>'), true),
        ]);

        await fireEvent.press(await screen.findByRole('button', { name: 'Mark all as read' }));

        await waitFor(() => expect(toast).toHaveBeenCalledWith("Couldn't mark 1 conversation as read. Try again."));
        expect(screen.getAllByTestId('conversation-unread')).toHaveLength(1);
        expect(mockedGet).toHaveBeenCalledTimes(1);
        toast.mockRestore();
    });

    it('says when the server has no way to mark them read', async () => {
        const toast = jest.spyOn(dialog, 'toast').mockImplementation(() => {});
        mockedPost.mockRejectedValue(Object.assign(new Error('Not found'), { response: { status: 404 } }));
        await renderScreen([conversation('c1', [ana], post('s1', ana, '<p>oi</p>'), true)]);

        await fireEvent.press(await screen.findByRole('button', { name: 'Mark all as read' }));

        await waitFor(() => expect(toast).toHaveBeenCalledWith("Your server doesn't let apps mark messages as read."));
        toast.mockRestore();
    });

    it('sends a few at a time', async () => {
        let inFlight = 0;
        let most = 0;
        mockedPost.mockImplementation(async () => {
            most = Math.max(most, ++inFlight);
            await new Promise(resolve => setTimeout(resolve, 0));
            inFlight--;
            return { data: {} };
        });
        await renderScreen(Array.from({ length: 10 }, (_, n) => conversation(`c${n}`, [ana], post(`s${n}`, ana, `<p>${n}</p>`), true)));

        await fireEvent.press(await screen.findByRole('button', { name: 'Mark all as read' }));

        await waitFor(() => expect(mockedPost).toHaveBeenCalledTimes(10));
        expect(most).toBe(4);
    });

    it("opens a read conversation without marking it again", async () => {
        await renderScreen([conversation('c1', [ana], post('s1', ana, '<p>oi</p>'))]);

        await fireEvent.press(await screen.findByRole('button', { name: 'Ana. oi' }));

        expect(onStatusPress).toHaveBeenCalledWith('s1');
        expect(mockedPost).not.toHaveBeenCalled();
    });

    it('says how to start one when there are none', async () => {
        await renderScreen([]);

        expect(await screen.findByText(/No messages yet/)).toBeTruthy();
    });
});

describe('groupConversations', () => {
    it('groups by the same set of people, in any order, keeping the newest first', () => {
        const groups = groupConversations([
            conversation('c1', [ana, bruno], post('s1', ana, 'a')),
            conversation('c2', [ana], post('s2', ana, 'b')),
            conversation('c3', [bruno, ana], post('s3', bruno, 'c'), true),
        ]);
        expect(groups.map(group => [group.key, group.threads.map(thread => thread.id), group.unread])).toEqual([
            ['ana,bruno', ['c1', 'c3'], true],
            ['ana', ['c2'], false],
        ]);
    });
});

describe('ConversationGroupScreen', () => {
    it("numbers each thread, shows its last message, and opens it marked read", async () => {
        mockedGet.mockResolvedValue({
            data: [
                conversation('c1', [ana], post('s1', me, '<p>tô indo</p>'), true),
                conversation('c2', [bruno], post('s2', bruno, '<p>outro</p>')),
                conversation('c3', [ana], post('s3', ana, '<p>oi</p>')),
            ],
            headers: {},
        });
        mockedPost.mockResolvedValue({ data: {} });
        const onStatusPress = jest.fn();
        await render(
            <QueryClientProvider client={createTestQueryClient()}>
                <ConversationGroupScreen groupKey="ana" onBack={jest.fn()} onStatusPress={onStatusPress} />
            </QueryClientProvider>
        );

        expect(await screen.findByText('2 conversations')).toBeTruthy();
        // Oldest is 1
        expect(screen.getByRole('button', { name: 'Conversation 1. Ana: oi' })).toBeTruthy();
        expect(screen.queryByText('outro')).toBeNull();

        await fireEvent.press(screen.getByRole('button', { name: 'Conversation 2. Unread. You: tô indo' }));
        expect(mockedPost).toHaveBeenCalledWith('/conversations/c1/read');
        expect(onStatusPress).toHaveBeenCalledWith('s1');
    });
});
