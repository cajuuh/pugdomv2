import React from 'react';
import { cleanup, render, screen } from '@testing-library/react-native';
import App from '../App';
import { queryClient } from '../services/queryClient';

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

        expect(await screen.findByText('Welcome to Pugdom')).toBeTruthy();
        expect(screen.getByPlaceholderText('e.g. mastodon.social')).toBeTruthy();
        // Nothing should be fetched before anyone logs in
        expect(queryClient.getQueryCache().getAll().filter(query => query.state.fetchStatus !== 'idle')).toHaveLength(0);
    });
});
