import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils/queryClient';
import Settings from '../screens/Settings/settings';
import { NavigationProvider } from '../services/navigationContext';
import { Account } from '../services/mastodon/types';

// The F-Droid / GitHub build, which has no push
jest.mock('../services/push', () => ({ ...jest.requireActual('../services/push'), pushAvailable: false }));
jest.mock('../services/api/client', () => ({
    __esModule: true,
    default: { get: jest.fn(async () => ({ data: [], headers: {} })), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock('../services/storage', () => ({
    getCredentials: async () => ({ accessToken: 'token', instanceUrl: 'https://home.social' }),
    getSetting: async (_key: string, fallback: boolean) => fallback,
    saveSetting: async () => {},
}));
const me: Account = { id: 'me', username: 'me', acct: 'me', display_name: 'Me', avatar: '', emojis: [] };
jest.mock('../services/authContext', () => ({
    useAuth: () => ({ user: me, savedAccounts: [], logout: jest.fn(), switchAccount: jest.fn(), setAddingAccount: jest.fn(), updateUser: jest.fn() }),
    useOptionalAuth: () => ({ user: me }),
}));
jest.mock('../services/themeContext', () => ({ useTheme: () => jest.requireActual('../testUtils/theme').mockTheme }));
jest.mock('../services/settingsContext', () => ({
    useOptionalSettings: () => null,
    useSettings: () => ({ notifications: false, setNotifications: jest.fn(), mediaAutoplay: false, setMediaAutoplay: jest.fn() }),
}));
jest.mock('../services/composeContext', () => ({ useCompose: () => ({ openCompose: jest.fn() }) }));

describe('Settings in the build without push', () => {
    it('says why there are no push notifications instead of leaving the switch out', async () => {
        await render(
            <QueryClientProvider client={createTestQueryClient()}>
                <NavigationProvider>
                    <Settings onBack={jest.fn()} onScheduledPosts={jest.fn()} onDrafts={jest.fn()} onModeratedAccounts={jest.fn()} onFilters={jest.fn()} />
                </NavigationProvider>
            </QueryClientProvider>,
        );

        expect(screen.getByLabelText(/^Push Notifications\. This version has no Google services/)).toBeTruthy();
        expect(screen.queryByRole('switch', { name: 'Push Notifications' })).toBeNull();
    });
});
