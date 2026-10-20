import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils/queryClient';
import { getPreferences } from '../services/mastodon/preferences';
import { useMediaDisplay } from '../hooks/useExpandSpoilers';

const mockSettings: { showSensitiveMedia: boolean | null; expandSpoilers: boolean | null } = { showSensitiveMedia: null, expandSpoilers: null };
jest.mock('../services/settingsContext', () => ({ useSettings: () => mockSettings }));
jest.mock('../services/authContext', () => ({ useOptionalAuth: () => ({ user: { id: 'me' } }) }));
jest.mock('../services/mastodon/preferences', () => ({ getPreferences: jest.fn() }));

const display = async (account: string | undefined, app: boolean | null) => {
    (getPreferences as jest.Mock).mockResolvedValue(account ? { 'reading:expand:media': account } : {});
    mockSettings.showSensitiveMedia = app;
    const { result } = await renderHook(() => useMediaDisplay(), {
        wrapper: ({ children }) => <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>,
    });
    await waitFor(() => expect(getPreferences).toHaveBeenCalled());
    await waitFor(() => expect(result.current).toBeDefined());
    return result;
};

describe('useMediaDisplay', () => {
    it("follows the account's Media display until the app's switch is used", async () => {
        const result = await display('show_all', null);
        await waitFor(() => expect(result.current).toBe('show_all'));
        expect((await display('default', null)).current).toBe('default');
    });

    it("lets the app's switch show sensitive media, or turn the account's show-all off", async () => {
        const on = await display('default', true);
        await waitFor(() => expect(on.current).toBe('show_all'));
        const off = await display('show_all', false);
        await waitFor(() => expect(off.current).toBe('default'));
    });

    it("keeps the account's hide-all unless the app shows sensitive media", async () => {
        const hidden = await display('hide_all', null);
        await waitFor(() => expect(hidden.current).toBe('hide_all'));
        const shown = await display('hide_all', true);
        await waitFor(() => expect(shown.current).toBe('show_all'));
    });
});
