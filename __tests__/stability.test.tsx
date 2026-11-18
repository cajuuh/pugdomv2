import React from 'react';
import { AppState, AppStateStatus, Text } from 'react-native';
import { act, fireEvent, render, renderHook } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import * as Updates from 'expo-updates';
import { createTestQueryClient } from '../testUtils/queryClient';
import { useRemoveCachedStatus, useUpdateCachedStatus } from '../hooks/useUpdateCachedStatus';
import { keepNewest, LIVE_LIMIT } from '../hooks/useFeed';
import { StreamConnection } from '../services/mastodon/streaming';
import { useAppUpdates } from '../hooks/useAppUpdates';
import { ErrorBoundary } from '../components/ErrorBoundary/errorBoundary';
import * as settings from '../services/settingsContext';
import { dialog } from '../services/dialog';
import { Status } from '../services/mastodon/types';

jest.mock('expo-updates', () => ({
    __esModule: true,
    isEnabled: true,
    checkAutomatically: 'ON_LOAD',
    useUpdates: jest.fn(() => ({ isUpdatePending: false })),
    checkForUpdateAsync: jest.fn(),
    fetchUpdateAsync: jest.fn(),
    reloadAsync: jest.fn(),
}));
jest.mock('../services/navigationContext', () => ({ useNavigator: () => ({ reset: mockReset }) }));
const mockReset = jest.fn();
jest.mock('../services/themeContext', () => ({ useTheme: () => jest.requireActual('../testUtils/theme').mockTheme }));

const post = (id: string) => ({ id, content: `post ${id}`, visibility: 'public', account: { id: 'a' } } as Status);

describe('a screen that crashes', () => {
    it('shows the error screen instead of closing, and goes back Home', async () => {
        let broken = true;
        const Screen = () => {
            if (broken) throw new Error('boom');
            return <Text>Home</Text>;
        };
        const screen = await render(<ErrorBoundary><Screen /></ErrorBoundary>);
        expect(screen.getByText('Something went wrong')).toBeTruthy();
        broken = false;
        await fireEvent.press(screen.getByText('Back to Home'));
        expect(mockReset).toHaveBeenCalled();
        expect(screen.getByText('Home')).toBeTruthy();
    });
});

describe('live events on posts that aren\'t loaded', () => {
    it('leave every cached list as it was, so nothing redraws', async () => {
        const client = createTestQueryClient();
        const timeline = { pages: [[post('3'), post('2')]], pageParams: [undefined] };
        const notifications = { pages: [{ groups: [{ key: 'g', status: post('2') }] }], pageParams: [undefined] };
        client.setQueryData(['timeline', 'home'], timeline);
        client.setQueryData(['notifications', 'all', true], notifications);
        const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
        const { result } = await renderHook(() => ({ remove: useRemoveCachedStatus(), update: useUpdateCachedStatus() }), { wrapper });

        act(() => {
            result.current.remove('99');
            result.current.update(post('98'));
        });
        expect(client.getQueryData(['timeline', 'home'])).toBe(timeline);
        expect(client.getQueryData(['notifications', 'all', true])).toBe(notifications);

        act(() => result.current.remove('2'));
        expect((client.getQueryData(['timeline', 'home']) as typeof timeline).pages[0].map(p => p.id)).toEqual(['3']);
        expect((client.getQueryData(['notifications', 'all', true]) as typeof notifications).pages[0].groups).toEqual([]);
    });
});

describe('a feed left at its top', () => {
    it('keeps only the newest posts, with the last one as the cursor', () => {
        const posts = Array.from({ length: LIVE_LIMIT + 50 }, (_, i) => post(String(10000 - i)));
        const trimmed = keepNewest({ pages: [posts.slice(0, 100), posts.slice(100)], pageParams: [undefined, '9900'] });
        expect(trimmed.pages).toHaveLength(1);
        expect(trimmed.pages[0]).toHaveLength(LIVE_LIMIT);
        expect(trimmed.pageParams).toEqual([undefined]);
        const short = { pages: [posts.slice(0, 10)], pageParams: [undefined] };
        expect(keepNewest(short)).toBe(short);
    });
});

describe('a stream listener that throws', () => {
    it('doesn\'t stop the others or escape the socket', () => {
        const realSocket = global.WebSocket;
        let socket: any;
        (global as any).WebSocket = class {
            static OPEN = 1;
            onmessage?: (event: { data: string }) => void;
            constructor() {
                socket = this;
            }
            close() {}
        };
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        const connection = new StreamConnection();
        const second = jest.fn();
        connection.listen(() => {
            throw new Error('bad payload');
        });
        connection.listen(second);
        connection.start('wss://home.social/api/v1/streaming', 'token');
        expect(() => socket.onmessage({ data: '{"event":"update","payload":"{}"}' })).not.toThrow();
        expect(second).toHaveBeenCalled();
        connection.stop();
        global.WebSocket = realSocket;
    });
});

describe('automatic updates off', () => {
    let appStateListener: ((state: AppStateStatus) => void) | undefined;
    beforeEach(() => {
        jest.spyOn(AppState, 'addEventListener').mockImplementation((_, listener) => {
            appStateListener = listener as (state: AppStateStatus) => void;
            return { remove: jest.fn() } as any;
        });
        jest.spyOn(settings, 'useOptionalSettings').mockReturnValue({ autoUpdates: false, loadingSettings: false } as any);
    });
    afterEach(() => jest.restoreAllMocks());

    it('neither checks on coming back nor offers a restart', async () => {
        appStateListener = undefined;
        const alert = jest.spyOn(dialog, 'alert').mockImplementation(() => {});
        (Updates.useUpdates as jest.Mock).mockReturnValue({ isUpdatePending: true, downloadedUpdate: { updateId: 'u9' } });
        await renderHook(() => useAppUpdates());
        await act(async () => appStateListener?.('active'));
        expect(appStateListener).toBeUndefined();
        expect(Updates.checkForUpdateAsync).not.toHaveBeenCalled();
        expect(alert).not.toHaveBeenCalled();
    });
});
