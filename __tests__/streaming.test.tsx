import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils/queryClient';
import apiClient from '../services/api/client';
import { eventKey, feedStream, socketUrl, StreamConnection, streamKey } from '../services/mastodon/streaming';
import { handleStreamEvent } from '../hooks/useStreaming';
import { useFeed } from '../hooks/useFeed';
import { newPostsKey, summarizeNewPosts } from '../hooks/useNewPosts';
import { Status } from '../services/mastodon/types';

jest.mock('../services/api/client', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('../services/mastodon/markers', () => ({ getHomeMarker: jest.fn(async () => null), saveHomeMarker: jest.fn() }));

const post = (id: string) => ({ id, content: `post ${id}`, visibility: 'public', account: { id: 'a' } } as Status);

class FakeSocket {
    static OPEN = 1;
    static made: FakeSocket[] = [];
    readyState = 0;
    sent: unknown[] = [];
    onopen?: () => void;
    onmessage?: (event: { data: string }) => void;
    onclose?: () => void;
    constructor(public url: string, public protocol: string) {
        FakeSocket.made.push(this);
    }
    send(data: string) {
        this.sent.push(JSON.parse(data));
    }
    close() {
        this.readyState = 3;
        this.onclose?.();
    }
    open() {
        this.readyState = 1;
        this.onopen?.();
    }
}

describe('streams', () => {
    it('picks the stream for each feed', () => {
        expect(feedStream({ id: 'home', kind: 'home' })).toEqual({ stream: 'user' });
        expect(feedStream({ id: 'local', kind: 'local' })).toEqual({ stream: 'public:local' });
        expect(feedStream({ id: 'list-1', kind: 'list', listId: '1' })).toEqual({ stream: 'list', list: '1' });
        expect(feedStream({ id: 't', kind: 'hashtag', criteria: { tag: 'Pugs' } } as any)).toEqual({ stream: 'hashtag', tag: 'Pugs' });
        // Mixed tags can't be streamed as one
        expect(feedStream({ id: 't', kind: 'hashtag', criteria: { tag: 'pugs', none: ['cats'] } } as any)).toBeNull();
        expect(feedStream({ id: 'trending', kind: 'trending' })).toBeNull();
        expect(feedStream({ id: 's', kind: 'server', domain: 'art.social' } as any)).toBeNull();
    });

    it('matches events to subscriptions', () => {
        expect(eventKey(['hashtag', 'Pugs'])).toBe(streamKey({ stream: 'hashtag', tag: 'pugs' }));
        expect(eventKey(['list', '1'])).toBe(streamKey({ stream: 'list', list: '1' }));
        expect(eventKey(['public:local'])).toBe(streamKey({ stream: 'public:local' }));
    });

    it('builds the socket address', () => {
        expect(socketUrl('https://home.social/')).toBe('wss://home.social/api/v1/streaming');
        expect(socketUrl('wss://streaming.home.social')).toBe('wss://streaming.home.social/api/v1/streaming');
        expect(socketUrl('http://localhost:3999')).toBe('ws://localhost:3999/api/v1/streaming');
    });
});

describe('StreamConnection', () => {
    const realSocket = global.WebSocket;
    beforeEach(() => {
        jest.useFakeTimers();
        FakeSocket.made = [];
        (global as any).WebSocket = FakeSocket;
    });
    afterEach(() => {
        jest.useRealTimers();
        global.WebSocket = realSocket;
    });

    it('sends the token as the protocol, not in the address, and subscribes once open', () => {
        const connection = new StreamConnection();
        connection.subscribe({ stream: 'user' });
        connection.start('wss://home.social/api/v1/streaming', 'secret');

        const socket = FakeSocket.made[0];
        expect(socket.url).toBe('wss://home.social/api/v1/streaming');
        expect(socket.protocol).toBe('secret');
        socket.open();
        expect(socket.sent).toEqual([{ type: 'subscribe', stream: 'user' }]);
    });

    it('counts subscribers, and unsubscribes when the last one leaves', () => {
        const connection = new StreamConnection();
        connection.start('wss://x', 't');
        const socket = FakeSocket.made[0];
        socket.open();
        const first = connection.subscribe({ stream: 'list', list: '1' });
        const second = connection.subscribe({ stream: 'list', list: '1' });
        first();
        expect(socket.sent).toEqual([{ type: 'subscribe', stream: 'list', list: '1' }]);
        second();
        expect(socket.sent).toEqual([{ type: 'subscribe', stream: 'list', list: '1' }, { type: 'unsubscribe', stream: 'list', list: '1' }]);
    });

    it('passes events on, reconnects after a drop and subscribes again, and stays closed once stopped', () => {
        const connection = new StreamConnection();
        const heard = jest.fn();
        connection.listen(heard);
        connection.subscribe({ stream: 'public' });
        connection.start('wss://x', 't');
        FakeSocket.made[0].open();
        FakeSocket.made[0].onmessage?.({ data: JSON.stringify({ stream: ['public'], event: 'delete', payload: '5' }) });
        expect(heard).toHaveBeenCalledWith({ stream: ['public'], event: 'delete', payload: '5' });

        // The server drops it
        FakeSocket.made[0].onclose?.();
        jest.advanceTimersByTime(1000);
        expect(FakeSocket.made).toHaveLength(2);
        FakeSocket.made[1].open();
        expect(FakeSocket.made[1].sent).toEqual([{ type: 'subscribe', stream: 'public' }]);

        connection.stop();
        jest.advanceTimersByTime(60_000);
        expect(FakeSocket.made).toHaveLength(2);
    });
});

describe('handleStreamEvent', () => {
    const handlers = () => ({ update: jest.fn(), remove: jest.fn(), notified: jest.fn() });

    it('removes deleted posts, replaces edited ones, and refreshes notifications', () => {
        const h = handlers();
        handleStreamEvent({ event: 'delete', payload: '7' }, h);
        handleStreamEvent({ event: 'status.update', payload: JSON.stringify(post('8')) }, h);
        handleStreamEvent({ event: 'notification', payload: '{}' }, h);
        handleStreamEvent({ event: 'update', payload: JSON.stringify(post('9')) }, h);

        expect(h.remove).toHaveBeenCalledWith('7');
        expect(h.update).toHaveBeenCalledWith(expect.objectContaining({ id: '8' }));
        expect(h.notified).toHaveBeenCalledTimes(1);
    });
});

describe('live posts in a feed', () => {
    const setup = async () => {
        (apiClient.get as jest.Mock).mockResolvedValue({ data: [post('10'), post('9')] });
        const queryClient = createTestQueryClient();
        const hook = await renderHook(() => useFeed({ id: 'local', kind: 'local' }), {
            wrapper: ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
        });
        await waitFor(() => expect(hook.result.current.items).toHaveLength(2));
        return { ...hook, queryClient };
    };

    it('go on top of the list when you are at the top', async () => {
        const { result } = await setup();
        await act(async () => result.current.addStreamed([post('11'), post('10')], true));
        await waitFor(() => expect(result.current.items.map(item => item.id)).toEqual(['11', '10', '9']));
    });

    it('wait in the new posts pill when you have scrolled down', async () => {
        const { result, queryClient } = await setup();
        await act(async () => result.current.addStreamed([post('11')], false));
        await act(async () => result.current.addStreamed([post('12'), post('11')], false));

        expect(result.current.items.map(item => item.id)).toEqual(['10', '9']);
        const waiting = queryClient.getQueryData<Status[]>(newPostsKey('local', '10'))!;
        expect(summarizeNewPosts(waiting).count).toBe(2);
    });
});
