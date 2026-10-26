import { renderHook, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { publicClient } from '../services/api/client';
import { getNotification } from '../services/mastodon/notifications';
import { DEFAULT_PUSH_ALERTS, RELAY_URL, routeForNotification, syncPush } from '../services/push';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { SavedAccount } from '../services/storage';
import { Notification } from '../services/mastodon/types';

jest.mock('../services/api/client', () => ({
    __esModule: true,
    default: { get: jest.fn() },
    publicClient: { post: jest.fn(), delete: jest.fn() },
}));
jest.mock('../services/mastodon/notifications', () => ({ getNotification: jest.fn() }));
let mockActiveToken = 'token-a';
jest.mock('../services/storage', () => ({ getCredentials: async () => ({ accessToken: mockActiveToken, instanceUrl: 'https://a.social' }) }));
const mockSwitchAccount = jest.fn();
const mockPush = jest.fn();
jest.mock('../services/authContext', () => ({
    useAuth: () => ({ user: { id: 'me' }, savedAccounts: mockAccounts, switchAccount: mockSwitchAccount }),
}));
jest.mock('../services/settingsContext', () => ({
    useSettings: () => ({ notifications: true, pushAlerts: jest.requireActual('../services/push').DEFAULT_PUSH_ALERTS, loadingSettings: false }),
}));
jest.mock('../services/i18n/i18nContext', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
jest.mock('../services/navigationContext', () => ({ useNavigator: () => ({ push: mockPush }) }));

const account = (id: string, accessToken: string, instanceUrl: string) =>
    ({ id, accessToken, instanceUrl, userInfo: { id, username: id, display_name: id, avatar: '', acct: id } }) as SavedAccount;
const mockAccounts = [account('ana@https://a.social', 'token-a', 'https://a.social'), account('bo@https://b.social', 'token-b', 'https://b.social')];

const client = publicClient as unknown as Record<'post' | 'delete', jest.Mock>;
const notifications = Notifications as jest.Mocked<typeof Notifications>;

beforeEach(() => {
    jest.clearAllMocks();
    mockActiveToken = 'token-a';
    client.post.mockImplementation(async (url: string, body: { account?: string }) =>
        url.startsWith(RELAY_URL) ? { data: { endpoint: `${RELAY_URL}/push/sealed-${body.account}`, p256dh: 'pub', auth: 'sec' } } : { data: {} });
});

describe('push subscriptions', () => {
    it('subscribes every account through the relay with its own token and the chosen types', async () => {
        await syncPush(mockAccounts, true, { ...DEFAULT_PUSH_ALERTS, favourite: false, quote: false }, 'Notifications');

        expect(client.post).toHaveBeenCalledWith(`${RELAY_URL}/register`, { token: 'ExponentPushToken[test]', account: 'ana@https://a.social' });
        expect(client.post).toHaveBeenCalledWith('https://b.social/api/v1/push/subscription', {
            subscription: { endpoint: `${RELAY_URL}/push/sealed-bo@https://b.social`, keys: { p256dh: 'pub', auth: 'sec' }, standard: true },
            data: { alerts: { ...DEFAULT_PUSH_ALERTS, favourite: false, quote: false, quoted_update: false }, policy: 'all' },
        }, { headers: { Authorization: 'Bearer token-b' } });
        expect(client.post).toHaveBeenCalledWith('https://a.social/api/v1/push/subscription', expect.anything(), { headers: { Authorization: 'Bearer token-a' } });
    });

    it('unsubscribes every account when push is off', async () => {
        await syncPush(mockAccounts, false, DEFAULT_PUSH_ALERTS, 'Notifications');

        expect(client.post).not.toHaveBeenCalled();
        expect(client.delete).toHaveBeenCalledWith('https://a.social/api/v1/push/subscription', { headers: { Authorization: 'Bearer token-a' } });
        expect(client.delete).toHaveBeenCalledWith('https://b.social/api/v1/push/subscription', { headers: { Authorization: 'Bearer token-b' } });
    });

    it('does nothing when the permission is refused', async () => {
        notifications.getPermissionsAsync.mockResolvedValueOnce({ granted: false } as never);
        notifications.requestPermissionsAsync.mockResolvedValueOnce({ granted: false } as never);
        await syncPush(mockAccounts, true, DEFAULT_PUSH_ALERTS, 'Notifications');

        expect(notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
        expect(client.post).not.toHaveBeenCalled();
    });
});

describe('tapping a push', () => {
    const tap = (accountId: string) => notifications.useLastNotificationResponse.mockReturnValue({
        actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
        notification: { request: { identifier: 'n1', content: { data: { account: accountId, notificationId: '42', type: 'mention' } } } },
    } as never);
    afterEach(() => notifications.useLastNotificationResponse.mockReturnValue(null));

    it('opens the post it is about', async () => {
        (getNotification as jest.Mock).mockResolvedValue({ id: '42', type: 'mention', account: { id: 'x' }, status: { id: 's9' } });
        tap('ana@https://a.social');
        renderHook(() => usePushNotifications(true, jest.fn()));

        await waitFor(() => expect(mockPush).toHaveBeenCalledWith({ name: 'thread', statusId: 's9' }));
        expect(getNotification).toHaveBeenCalledWith('42');
        expect(mockSwitchAccount).not.toHaveBeenCalled();
    });

    it("switches to the push's account first", async () => {
        tap('bo@https://b.social');
        renderHook(() => usePushNotifications(true, jest.fn()));

        await waitFor(() => expect(mockSwitchAccount).toHaveBeenCalledWith('bo@https://b.social'));
        expect(getNotification).not.toHaveBeenCalled();
    });

    it('opens Notifications when the notification is gone', async () => {
        (getNotification as jest.Mock).mockRejectedValue(new Error('404'));
        tap('ana@https://a.social');
        const openNotifications = jest.fn();
        renderHook(() => usePushNotifications(true, openNotifications));

        await waitFor(() => expect(openNotifications).toHaveBeenCalled());
        expect(mockPush).not.toHaveBeenCalled();
    });

    it('opens the profile of a new follower', () => {
        const follower = { id: 'f1' } as Notification['account'];
        expect(routeForNotification({ id: '1', type: 'follow', created_at: '', account: follower })).toEqual({ name: 'account', accountId: 'f1', account: follower });
    });
});
