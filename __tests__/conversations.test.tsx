import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils/queryClient';
import apiClient from '../services/api/client';
import { Conversation, getConversations } from '../services/mastodon/conversations';
import { unreadConversationsKey } from '../hooks/useUnreadConversations';
import Conversations from '../screens/Conversations/conversations';
import { Account, Status } from '../services/mastodon/types';

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

    const renderScreen = async (conversations: Conversation[]) => {
        mockedGet.mockResolvedValue({ data: conversations, headers: {} });
        queryClient = createTestQueryClient();
        await render(
            <QueryClientProvider client={queryClient}>
                <Conversations onBack={jest.fn()} onStatusPress={onStatusPress} />
            </QueryClientProvider>
        );
    };

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
