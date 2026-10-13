import React from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils/queryClient';
import apiClient from '../services/api/client';
import { fetchNewerPosts, NEW_POSTS_LIMIT } from '../services/mastodon/timeline';
import { NEW_POSTS_INTERVAL_MS, summarizeNewPosts, useNewPosts } from '../hooks/useNewPosts';
import { useFeed } from '../hooks/useFeed';
import { Account, Status } from '../services/mastodon/types';

jest.mock('../services/api/client', () => ({ __esModule: true, default: { get: jest.fn() } }));

const mockedGet = apiClient.get as jest.Mock;
const account = (id: string): Account => ({ id, username: `user${id}`, acct: `user${id}`, display_name: `User ${id}`, avatar: '', emojis: [] });
const post = (id: string, accountId = id, visibility: Status['visibility'] = 'public') =>
    ({ id, content: `post ${id}`, account: account(accountId), visibility } as Status);

describe('fetchNewerPosts', () => {
    beforeEach(() => mockedGet.mockReset().mockResolvedValue({ data: [] }));

    it.each([
        ['home', '/timelines/home', undefined],
        ['local', '/timelines/public', true],
        ['federated', '/timelines/public', undefined],
    ] as const)('asks the %s timeline for posts since the top one', async (feed, path, local) => {
        await fetchNewerPosts(feed, '100');

        expect(mockedGet).toHaveBeenCalledWith(path, { params: { since_id: '100', limit: NEW_POSTS_LIMIT, local } });
    });
});

describe('summarizeNewPosts', () => {
    it('counts the posts and keeps up to three different authors', () => {
        const summary = summarizeNewPosts([post('5', 'a'), post('4', 'a'), post('3', 'b'), post('2', 'c'), post('1', 'd')]);

        expect(summary.count).toBe(5);
        expect(summary.more).toBe(false);
        expect(summary.accounts.map(a => a.id)).toEqual(['a', 'b', 'c']);
    });

    it("doesn't count direct posts, which the timeline leaves out", () => {
        const summary = summarizeNewPosts([post('3', 'a', 'direct'), post('2', 'b'), post('1', 'c', 'direct')]);
        expect(summary.count).toBe(1);
        expect(summary.accounts.map(a => a.id)).toEqual(['b']);
    });

    it('marks a full page as possibly more', () => {
        const page = Array.from({ length: NEW_POSTS_LIMIT }, (_, i) => post(String(i)));
        expect(summarizeNewPosts(page).more).toBe(true);
    });
});

describe('useFeed', () => {
    it('leaves direct posts out, but pages on from the last post the server sent', async () => {
        mockedGet.mockReset()
            .mockResolvedValueOnce({ data: [post('5'), post('4', '4', 'direct'), post('3'), post('2', '2', 'direct')] })
            .mockResolvedValueOnce({ data: [post('1')] });
        const queryClient = createTestQueryClient();
        const { result } = await renderHook(() => useFeed({ id: 'home', kind: 'home' }), {
            wrapper: ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
        });

        await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));
        expect(result.current.data!.pages[0].map(status => status.id)).toEqual(['5', '3']);

        await act(() => result.current.fetchNextPage());
        expect(mockedGet).toHaveBeenLastCalledWith('/timelines/home', expect.objectContaining({ params: expect.objectContaining({ max_id: '2' }) }));
        await waitFor(() => expect(result.current.data!.pages.flat().map(status => status.id)).toEqual(['5', '3', '1']));
    });
});

describe('useNewPosts', () => {
    let appStateListener: ((state: AppStateStatus) => void) | undefined;

    beforeEach(() => {
        jest.useFakeTimers();
        mockedGet.mockReset().mockResolvedValue({ data: [post('201'), post('200')] });
        jest.spyOn(AppState, 'addEventListener').mockImplementation((_, listener) => {
            appStateListener = listener as (state: AppStateStatus) => void;
            return { remove: jest.fn() } as any;
        });
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    const renderNewPosts = (newestId: string | undefined) => {
        const queryClient = createTestQueryClient();
        return renderHook(() => useNewPosts('home', newestId), {
            wrapper: ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
        });
    };

    it('waits a minute after the list loads, then reports what is new', async () => {
        const { result } = await renderNewPosts('199');
        expect(mockedGet).not.toHaveBeenCalled();
        expect(result.current.count).toBe(0);

        await act(async () => {
            await jest.advanceTimersByTimeAsync(NEW_POSTS_INTERVAL_MS + 10);
        });

        expect(mockedGet).toHaveBeenCalledWith('/timelines/home', expect.objectContaining({ params: expect.objectContaining({ since_id: '199' }) }));
        expect(result.current.count).toBe(2);
    });

    it('stops checking while the app is in the background', async () => {
        await renderNewPosts('199');
        await act(async () => appStateListener?.('background'));

        await act(async () => {
            await jest.advanceTimersByTimeAsync(NEW_POSTS_INTERVAL_MS * 3);
        });

        expect(mockedGet).not.toHaveBeenCalled();
    });

    it('does nothing until the list has a post', async () => {
        await renderNewPosts(undefined);
        await act(async () => {
            await jest.advanceTimersByTimeAsync(NEW_POSTS_INTERVAL_MS * 2);
        });
        expect(mockedGet).not.toHaveBeenCalled();
    });
});
