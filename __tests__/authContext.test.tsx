import React from 'react';
import { Alert, DeviceEventEmitter, Text } from 'react-native';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../services/authContext';
import { UNAUTHORIZED_EVENT } from '../services/api/client';
import { getCurrentAccount } from '../services/mastodon/accounts';
import * as storage from '../services/storage';

jest.mock('../services/mastodon/accounts', () => ({
    getCurrentAccount: jest.fn(),
}));

// In-memory replacement for SecureStore-backed storage
jest.mock('../services/storage', () => {
    let credentials = { accessToken: null as string | null, instanceUrl: null as string | null };
    let accounts: any[] = [];
    return {
        __setState: (creds: typeof credentials, saved: any[]) => {
            credentials = creds;
            accounts = saved;
        },
        getCredentials: jest.fn(async () => credentials),
        saveCredentials: jest.fn(async (accessToken: string, instanceUrl: string) => {
            credentials = { accessToken, instanceUrl };
        }),
        clearCredentials: jest.fn(async () => {
            credentials = { accessToken: null, instanceUrl: null };
        }),
        getSavedAccounts: jest.fn(async () => accounts),
        addSavedAccount: jest.fn(async (accessToken: string, instanceUrl: string, userInfo: any) => {
            const id = `${userInfo.acct}@${instanceUrl}`;
            accounts = [...accounts.filter(a => a.id !== id), { id, accessToken, instanceUrl, userInfo }];
        }),
        removeSavedAccount: jest.fn(async (id: string) => {
            accounts = accounts.filter(a => a.id !== id);
        }),
    };
});

const mockedStorage = storage as jest.Mocked<typeof storage> & { __setState: (creds: any, saved: any[]) => void };
const mockedGetCurrentAccount = getCurrentAccount as jest.MockedFunction<typeof getCurrentAccount>;

const makeAccount = (acct: string, instanceUrl: string, accessToken: string) => ({
    id: `${acct}@${instanceUrl}`,
    accessToken,
    instanceUrl,
    userInfo: { id: acct, username: acct, display_name: acct, avatar: '', acct },
});

const alice = makeAccount('alice', 'https://one.social', 'alice-token');
const bob = makeAccount('bob', 'https://two.social', 'bob-token');

let auth: ReturnType<typeof useAuth>;
let queryClient: QueryClient;

const CurrentUser = () => {
    auth = useAuth();
    const { user, loading } = auth;
    return <Text>{loading ? 'loading' : user?.acct ?? 'logged-out'}</Text>;
};

const renderAuth = async () => {
    queryClient = new QueryClient();
    await render(
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <CurrentUser />
            </AuthProvider>
        </QueryClientProvider>
    );
    await waitFor(() => expect(screen.queryByText('loading')).toBeNull());
};

const seedTimeline = () =>
    queryClient.setQueryData(['timeline', 'home'], { pages: [[{ id: 'cached-status' }]], pageParams: [undefined] });

const emitUnauthorized = (accessToken: string) =>
    act(async () => {
        DeviceEventEmitter.emit(UNAUTHORIZED_EVENT, { accessToken });
    });

describe('AuthProvider 401 handling', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(Alert, 'alert').mockImplementation(() => {});
        mockedGetCurrentAccount.mockImplementation(async () => {
            const { accessToken } = await mockedStorage.getCredentials();
            const account = [alice, bob].find(a => a.accessToken === accessToken)!;
            return { ...account.userInfo, emojis: [] };
        });
    });

    it('drops the rejected account and switches to the next one', async () => {
        mockedStorage.__setState({ accessToken: 'alice-token', instanceUrl: alice.instanceUrl }, [alice, bob]);
        await renderAuth();
        expect(screen.getByText('alice')).toBeTruthy();

        await emitUnauthorized('alice-token');

        await waitFor(() => expect(screen.getByText('bob')).toBeTruthy());
        expect(mockedStorage.removeSavedAccount).toHaveBeenCalledWith(alice.id);
        expect(Alert.alert).toHaveBeenCalledWith('Session expired', 'Please log in again to @alice.');
    });

    it('logs out completely when the last account is rejected', async () => {
        mockedStorage.__setState({ accessToken: 'alice-token', instanceUrl: alice.instanceUrl }, [alice]);
        await renderAuth();

        await emitUnauthorized('alice-token');

        await waitFor(() => expect(screen.getByText('logged-out')).toBeTruthy());
        expect(mockedStorage.clearCredentials).toHaveBeenCalled();
    });

    it('ignores 401s for a token that is no longer active', async () => {
        mockedStorage.__setState({ accessToken: 'bob-token', instanceUrl: bob.instanceUrl }, [alice, bob]);
        await renderAuth();

        await emitUnauthorized('alice-token');

        expect(screen.getByText('bob')).toBeTruthy();
        expect(mockedStorage.removeSavedAccount).not.toHaveBeenCalled();
        expect(Alert.alert).not.toHaveBeenCalled();
    });

    it('handles a burst of 401s from the same token once', async () => {
        mockedStorage.__setState({ accessToken: 'alice-token', instanceUrl: alice.instanceUrl }, [alice, bob]);
        await renderAuth();

        await act(async () => {
            DeviceEventEmitter.emit(UNAUTHORIZED_EVENT, { accessToken: 'alice-token' });
            DeviceEventEmitter.emit(UNAUTHORIZED_EVENT, { accessToken: 'alice-token' });
            DeviceEventEmitter.emit(UNAUTHORIZED_EVENT, { accessToken: 'alice-token' });
        });

        await waitFor(() => expect(screen.getByText('bob')).toBeTruthy());
        expect(mockedStorage.removeSavedAccount).toHaveBeenCalledTimes(1);
        expect(Alert.alert).toHaveBeenCalledTimes(1);
    });
});

describe('AuthProvider account changes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedGetCurrentAccount.mockImplementation(async () => {
            const { accessToken } = await mockedStorage.getCredentials();
            const account = [alice, bob].find(a => a.accessToken === accessToken)!;
            return { ...account.userInfo, emojis: [] };
        });
    });

    afterEach(() => queryClient.clear());

    it("drops the previous account's cached timelines when switching", async () => {
        mockedStorage.__setState({ accessToken: 'alice-token', instanceUrl: alice.instanceUrl }, [alice, bob]);
        await renderAuth();
        seedTimeline();

        await act(() => auth.switchAccount(bob.id));

        expect(screen.getByText('bob')).toBeTruthy();
        expect(queryClient.getQueryData(['timeline', 'home'])).toBeUndefined();
    });

    it('drops cached timelines on full logout', async () => {
        mockedStorage.__setState({ accessToken: 'alice-token', instanceUrl: alice.instanceUrl }, [alice]);
        await renderAuth();
        seedTimeline();

        await act(() => auth.logout());

        expect(screen.getByText('logged-out')).toBeTruthy();
        expect(queryClient.getQueryData(['timeline', 'home'])).toBeUndefined();
    });

    it('keeps the cache when removing an account that is not active', async () => {
        mockedStorage.__setState({ accessToken: 'alice-token', instanceUrl: alice.instanceUrl }, [alice, bob]);
        await renderAuth();
        seedTimeline();

        await act(() => auth.logout(bob.id));

        expect(screen.getByText('alice')).toBeTruthy();
        expect(queryClient.getQueryData(['timeline', 'home'])).toBeDefined();
    });

    it('drops cached timelines when a new account logs in', async () => {
        mockedStorage.__setState({ accessToken: 'alice-token', instanceUrl: alice.instanceUrl }, [alice]);
        await renderAuth();
        seedTimeline();

        await act(async () => auth.login({ ...bob.userInfo, emojis: [] }, bob.accessToken, bob.instanceUrl));

        expect(screen.getByText('bob')).toBeTruthy();
        expect(queryClient.getQueryData(['timeline', 'home'])).toBeUndefined();
    });
});
