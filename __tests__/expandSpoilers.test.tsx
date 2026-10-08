import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils/queryClient';
import apiClient from '../services/api/client';
import { useExpandSpoilers } from '../hooks/useExpandSpoilers';

jest.mock('../services/api/client', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('../services/authContext', () => ({ useOptionalAuth: () => ({ user: { id: 'me' } }) }));
let mockExpandSpoilers: boolean | null = null;
jest.mock('../services/settingsContext', () => ({ useSettings: () => ({ expandSpoilers: mockExpandSpoilers }) }));

const mockedGet = apiClient.get as jest.Mock;

const expandWith = async (setting: boolean | null, serverPreference: boolean) => {
    mockExpandSpoilers = setting;
    mockedGet.mockResolvedValue({ data: { 'reading:expand:spoilers': serverPreference, 'reading:expand:media': 'default' } });
    const client = createTestQueryClient();
    const { result } = await renderHook(() => useExpandSpoilers(), {
        wrapper: ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    });
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/preferences'));
    return result;
};

describe('useExpandSpoilers', () => {
    it("follows the account's web preference until you set the switch", async () => {
        const result = await expandWith(null, true);
        await waitFor(() => expect(result.current).toBe(true));

        expect((await expandWith(null, false)).current).toBe(false);
    });

    it('lets the switch win once you have set it', async () => {
        const off = await expandWith(false, true);
        await waitFor(() => expect(mockedGet).toHaveBeenCalled());
        expect(off.current).toBe(false);

        const on = await expandWith(true, false);
        expect(on.current).toBe(true);
    });
});
