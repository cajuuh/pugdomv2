import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils/queryClient';
import apiClient from '../services/api/client';
import {
    acceptNotificationRequest,
    getNotificationPolicy,
    getNotificationRequests,
    getRequestNotifications,
    NotificationPolicy,
    NotificationRequest,
    waitForMerge,
} from '../services/mastodon/notificationRequests';
import NotificationRequests from '../screens/NotificationRequests/notificationRequests';
import NotificationPolicyScreen from '../screens/NotificationRequests/notificationPolicy';
import { dialog } from '../services/dialog';
import { Account } from '../services/mastodon/types';

jest.mock('../services/api/client', () => ({
    __esModule: true,
    default: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
}));
jest.mock('../services/storage', () => ({
    getCredentials: async () => ({ accessToken: 'token', instanceUrl: 'https://home.social' }),
}));
jest.mock('../services/themeContext', () => ({ useTheme: () => jest.requireActual('../testUtils/theme').mockTheme }));
jest.mock('../services/settingsContext', () => ({ useOptionalSettings: () => null }));
jest.mock('../services/authContext', () => ({ useOptionalAuth: () => ({ user: { id: 'me' } }) }));

const api = apiClient as unknown as Record<'get' | 'post' | 'patch', jest.Mock>;
const ana: Account = { id: 'ana', username: 'ana', acct: 'ana@elsewhere.social', display_name: 'Ana', avatar: '', emojis: [] };
const request = (id: string, account = ana): NotificationRequest => ({
    id,
    created_at: '2026-11-13T10:00:00Z',
    updated_at: '2026-11-13T10:00:00Z',
    account,
    notifications_count: '3',
    last_status: { content: '<p>Hello there, pug friend</p>', spoiler_text: '' } as any,
});
const policy = (extra: Partial<NotificationPolicy> = {}): NotificationPolicy => ({
    for_not_following: 'accept',
    for_not_followers: 'accept',
    for_new_accounts: 'filter',
    for_private_mentions: 'filter',
    for_limited_accounts: 'filter',
    summary: { pending_requests_count: 1, pending_notifications_count: 3 },
    ...extra,
});

let queryClient: QueryClient;
const wrap = (children: React.ReactNode) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

beforeEach(() => {
    jest.clearAllMocks();
    queryClient = createTestQueryClient();
    jest.spyOn(dialog, 'toast').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('notification requests API', () => {
    it('reads the policy from v2, and gives null on servers without it', async () => {
        api.get.mockResolvedValueOnce({ data: policy() });
        expect(await getNotificationPolicy()).toEqual(policy());
        expect(api.get).toHaveBeenCalledWith('https://home.social/api/v2/notifications/policy');

        api.get.mockRejectedValueOnce({ response: { status: 404 } });
        expect(await getNotificationPolicy()).toBeNull();
    });

    it('pages requests with the Link header', async () => {
        api.get.mockResolvedValueOnce({ data: [request('r1')], headers: { link: '<https://home.social/api/v1/notifications/requests?max_id=r1>; rel="next"' } });
        expect(await getNotificationRequests()).toEqual({ requests: [request('r1')], nextMaxId: 'r1' });
    });

    it("accepts, and lists a request's notifications filtered ones included", async () => {
        api.post.mockResolvedValue({ data: {} });
        await acceptNotificationRequest('r1');
        expect(api.post).toHaveBeenCalledWith('/notifications/requests/r1/accept');

        api.get.mockResolvedValueOnce({ data: [] });
        await getRequestNotifications('ana');
        expect(api.get).toHaveBeenCalledWith('/notifications', { params: { account_id: 'ana', include_filtered: true, max_id: undefined } });
    });

    it('waits until the accepted notifications are merged', async () => {
        api.get.mockResolvedValueOnce({ data: { merged: false } }).mockResolvedValueOnce({ data: { merged: true } });
        await waitForMerge(5, 0);
        expect(api.get).toHaveBeenCalledTimes(2);
        expect(api.get).toHaveBeenCalledWith('/notifications/requests/merged');
    });
});

describe('Filtered notifications screen', () => {
    it('shows each account with what it sent, and accepting takes it off the list', async () => {
        api.get.mockImplementation(async (url: string) =>
            url === '/notifications/requests' ? { data: [request('r1')], headers: {} } : { data: { merged: true } }
        );
        api.post.mockResolvedValue({ data: {} });
        const onOpenRequest = jest.fn();
        await render(wrap(<NotificationRequests onBack={jest.fn()} onOpenRequest={onOpenRequest} onRules={jest.fn()} />));

        expect(await screen.findByText('Hello there, pug friend')).toBeTruthy();
        expect(screen.getByText('3 notifications')).toBeTruthy();
        await fireEvent.press(screen.getByRole('button', { name: /^3 notifications: Hello there/ }));
        expect(onOpenRequest).toHaveBeenCalledWith(request('r1'));

        await fireEvent.press(screen.getByRole('button', { name: 'Accept' }));
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('/notifications/requests/r1/accept'));
        await waitFor(() => expect(screen.queryByText('Hello there, pug friend')).toBeNull());
        await waitFor(() => expect(dialog.toast).toHaveBeenCalledWith('Their notifications are back in your list'));
    });

    it('puts a request back when dismissing fails', async () => {
        api.get.mockResolvedValue({ data: [request('r1')], headers: {} });
        api.post.mockRejectedValue(new Error('offline'));
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        await render(wrap(<NotificationRequests onBack={jest.fn()} onOpenRequest={jest.fn()} onRules={jest.fn()} />));

        await fireEvent.press(await screen.findByRole('button', { name: 'Dismiss' }));
        await waitFor(() => expect(dialog.toast).toHaveBeenCalledWith("Couldn't do that. Try again."));
        expect(screen.getByText('Hello there, pug friend')).toBeTruthy();
    });
});

describe('Filter notifications rules', () => {
    it('shows each rule and saves a change', async () => {
        api.get.mockResolvedValue({ data: policy() });
        api.patch.mockResolvedValue({ data: policy({ for_not_following: 'filter' }) });
        await render(wrap(<NotificationPolicyScreen onBack={jest.fn()} />));

        await fireEvent.press(await screen.findByRole('button', { name: "People you don't follow: Show" }));
        await fireEvent.press(screen.getByText('Held in Filtered notifications'));

        await waitFor(() => expect(api.patch).toHaveBeenCalledWith('https://home.social/api/v2/notifications/policy', { for_not_following: 'filter' }));
        expect(await screen.findByRole('button', { name: "People you don't follow: Filter" })).toBeTruthy();
    });
});
