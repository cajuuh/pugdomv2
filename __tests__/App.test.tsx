import React from 'react';
import { cleanup, render, screen } from '@testing-library/react-native';
import * as SplashScreen from 'expo-splash-screen';
import App from '../App';
import { queryClient } from '../services/queryClient';

jest.mock('expo-splash-screen', () => ({
    preventAutoHideAsync: jest.fn(async () => true),
    hideAsync: jest.fn(async () => {}),
}));

// Fresh install: nothing stored yet
jest.mock('../services/storage', () => ({
    getCredentials: jest.fn(async () => ({ accessToken: null, instanceUrl: null })),
    saveCredentials: jest.fn(),
    clearCredentials: jest.fn(),
    getSavedAccounts: jest.fn(async () => []),
    addSavedAccount: jest.fn(),
    removeSavedAccount: jest.fn(),
    getSetting: jest.fn(async (_key: string, fallback: boolean) => fallback),
    saveSetting: jest.fn(),
    getStringSetting: jest.fn(async (_key: string, fallback: string) => fallback),
    saveStringSetting: jest.fn(),
}));

describe('App', () => {
    // Unmount first: unmounting after clear() would schedule new 5-minute GC timers and keep jest alive
    afterEach(async () => {
        await cleanup();
        queryClient.clear();
    });

    it('boots to the login screen when no account is saved', async () => {
        await render(<App />);

       expect(await screen.findByText('pugdon')).toBeTruthy();
expect(
    screen.getByText('A friendly home for your federated social conversations.')
).toBeTruthy();
        expect(screen.getByPlaceholderText('e.g. mastodon.social')).toBeTruthy();
        // Nothing should be fetched before anyone logs in
        expect(queryClient.getQueryCache().getAll().filter(query => query.state.fetchStatus !== 'idle')).toHaveLength(0);
    });

    it('holds the splash until the app is ready, then hides it', async () => {
        expect(SplashScreen.preventAutoHideAsync).toHaveBeenCalled();

        await render(<App />);
        await screen.findByPlaceholderText('e.g. mastodon.social');

        expect(SplashScreen.hideAsync).toHaveBeenCalled();
    });
});
