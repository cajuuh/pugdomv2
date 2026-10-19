import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createTestQueryClient } from '../testUtils/queryClient';
import apiClient from '../services/api/client';
import { canSchedule, defaultScheduleTime } from '../services/mastodon/scheduledStatuses';
import ScheduledPosts from '../screens/Scheduled/scheduledPosts';
import { dialog } from '../services/dialog';

jest.mock('../services/api/client', () => ({ __esModule: true, default: { get: jest.fn(), put: jest.fn(), delete: jest.fn() } }));
jest.mock('../services/themeContext', () => ({ useTheme: () => jest.requireActual('../testUtils/theme').mockTheme }));
jest.mock('../services/authContext', () => ({ useOptionalAuth: () => ({ user: { id: 'me' } }) }));

const mockedGet = apiClient.get as jest.Mock;
const mockedDelete = apiClient.delete as jest.Mock;

const scheduled = (id: string, at: string, text: string, extra = {}) => ({ id, scheduled_at: at, params: { text }, media_attachments: [], ...extra });

describe('scheduling rules', () => {
    it('needs five minutes of notice', () => {
        const now = new Date('2026-10-19T12:00:00Z');
        expect(canSchedule(new Date('2026-10-19T12:04:59Z'), now)).toBe(false);
        expect(canSchedule(new Date('2026-10-19T12:05:00Z'), now)).toBe(true);
    });

    it('offers an hour from now, on a five-minute mark', () => {
        const at = defaultScheduleTime(new Date(2026, 9, 19, 12, 2, 30));
        expect([at.getHours(), at.getMinutes(), at.getSeconds()]).toEqual([13, 5, 0]);
    });
});

describe('ScheduledPosts', () => {
    const renderScreen = () =>
        render(
            <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
                <QueryClientProvider client={createTestQueryClient()}>
                    <ScheduledPosts onBack={jest.fn()} />
                </QueryClientProvider>
            </SafeAreaProvider>
        );

    beforeEach(() => jest.clearAllMocks());

    it('lists them soonest first, with their attachments and polls', async () => {
        mockedGet.mockResolvedValue({
            data: [
                scheduled('b', '2026-10-21T15:00:00.000Z', 'later one', { media_attachments: [{ id: 'm' }] }),
                scheduled('a', '2026-10-20T09:00:00.000Z', 'sooner one', { params: { text: 'sooner one', poll: { options: ['x', 'y'] } } }),
            ],
            headers: {},
        });
        await renderScreen();

        await screen.findByText('sooner one');
        expect(screen.getAllByText(/one$/).map(node => node.props.children)).toEqual(['sooner one', 'later one']);
        expect(screen.getByText('1 attachment')).toBeTruthy();
        expect(screen.getByText('Poll')).toBeTruthy();
    });

    it('cancels one after asking', async () => {
        mockedGet.mockResolvedValue({ data: [scheduled('a', '2026-10-20T09:00:00.000Z', 'bye')], headers: {} });
        mockedDelete.mockResolvedValue({});
        const alert = jest.spyOn(dialog, 'alert').mockImplementation((_title, _message, buttons) => buttons?.[1]?.onPress?.());
        await renderScreen();

        await fireEvent.press(await screen.findByRole('button', { name: 'Cancel post' }));

        expect(mockedDelete).toHaveBeenCalledWith('/scheduled_statuses/a');
        await waitFor(() => expect(screen.queryByText('bye')).toBeNull());
        alert.mockRestore();
    });

    it('says how to schedule when nothing is', async () => {
        mockedGet.mockResolvedValue({ data: [], headers: {} });
        await renderScreen();
        expect(await screen.findByText(/Nothing scheduled/)).toBeTruthy();
    });
});
