import apiClient from '../services/api/client';
import { getCredentials } from '../services/storage';
import { fetchNotificationGroups, mergeGroups } from '../services/mastodon/notifications';
import { Account, GroupedNotificationsResponse, NotificationGroup } from '../services/mastodon/types';

jest.mock('../services/api/client', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('../services/storage', () => ({ getCredentials: jest.fn() }));

const mockedGet = apiClient.get as jest.Mock;
const mockedCredentials = getCredentials as jest.Mock;

const account = (id: string): Account => ({ id, username: id, acct: id, display_name: id, avatar: '', emojis: [] });
const status = { id: 's1', content: '<p>which coat?</p>' };

// Each test uses its own instance, since the service remembers which instances lack v2
const useInstance = (url: string) => mockedCredentials.mockResolvedValue({ accessToken: 't', instanceUrl: url });
const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { response: { status } });

describe('fetchNotificationGroups', () => {
    beforeEach(() => jest.clearAllMocks());

    it('reads grouped notifications from v2', async () => {
        useInstance('https://v2.social');
        const data: GroupedNotificationsResponse = {
            accounts: [account('a'), account('b'), account('c')],
            statuses: [status as any],
            notification_groups: [
                {
                    group_key: 'favourite-s1',
                    notifications_count: 6,
                    type: 'favourite',
                    most_recent_notification_id: '120',
                    page_min_id: '101',
                    page_max_id: '120',
                    latest_page_notification_at: '2026-09-29T12:00:00Z',
                    sample_account_ids: ['a', 'b'],
                    status_id: 's1',
                },
                {
                    group_key: 'ungrouped-99',
                    notifications_count: 1,
                    type: 'follow',
                    most_recent_notification_id: '99',
                    page_min_id: '99',
                    page_max_id: '99',
                    latest_page_notification_at: '2026-09-29T11:00:00Z',
                    sample_account_ids: ['c'],
                    status_id: null,
                },
            ],
        };
        mockedGet.mockResolvedValue({ data });

        const page = await fetchNotificationGroups('150', ['favourite', 'follow']);

        expect(mockedGet).toHaveBeenCalledWith('https://v2.social/api/v2/notifications', {
            params: { max_id: '150', types: ['favourite', 'follow'], grouped_types: ['favourite', 'reblog'] },
        });
        expect(page.groups).toEqual([
            expect.objectContaining({
                key: 'favourite-s1',
                count: 6,
                accounts: [account('a'), account('b')],
                status,
                created_at: '2026-09-29T12:00:00Z',
                newestId: '120',
            }),
            expect.objectContaining({ key: 'ungrouped-99', type: 'follow', count: 1, accounts: [account('c')], status: undefined }),
        ]);
        // The next page starts below the oldest notification on this one
        expect(page.nextMaxId).toBe('99');
    });

    it('falls back to v1 and groups favourites by post on servers without v2', async () => {
        useInstance('https://old.social');
        mockedGet
            .mockRejectedValueOnce(httpError(404))
            .mockResolvedValueOnce({
                data: [
                    { id: '3', type: 'favourite', created_at: '2026-09-29T12:00:00Z', account: account('a'), status },
                    { id: '2', type: 'favourite', created_at: '2026-09-29T11:00:00Z', account: account('b'), status },
                    { id: '1', type: 'mention', created_at: '2026-09-29T10:00:00Z', account: account('c'), status: { id: 's2' } },
                ],
            });

        const page = await fetchNotificationGroups(undefined, ['favourite', 'mention']);

        expect(mockedGet).toHaveBeenLastCalledWith('/notifications', { params: { max_id: undefined, types: ['favourite', 'mention'] } });
        expect(page.groups.map(group => [group.key, group.count, group.accounts.map(a => a.id)])).toEqual([
            ['favourite-s1', 2, ['a', 'b']],
            ['ungrouped-1', 1, ['c']],
        ]);
        expect(page.nextMaxId).toBe('1');
    });

    it('goes straight to v1 once an instance has no v2', async () => {
        useInstance('https://older.social');
        mockedGet.mockRejectedValueOnce(httpError(404)).mockResolvedValue({ data: [] });

        await fetchNotificationGroups();
        await fetchNotificationGroups('5');

        expect(mockedGet.mock.calls.map(([url]) => url)).toEqual([
            'https://older.social/api/v2/notifications',
            '/notifications',
            '/notifications',
        ]);
    });

    it('does not hide other errors behind the fallback', async () => {
        useInstance('https://down.social');
        mockedGet.mockRejectedValueOnce(httpError(500));

        await expect(fetchNotificationGroups()).rejects.toThrow('HTTP 500');
        expect(mockedGet).toHaveBeenCalledTimes(1);
    });
});

describe('mergeGroups', () => {
    const group = (key: string, accounts: string[], count: number, partial?: boolean): NotificationGroup => ({
        key, type: 'favourite', accounts: accounts.map(account), count, created_at: '', newestId: '1', partial,
    });

    it('adds up client-side groups that continue on the next page', () => {
        const merged = mergeGroups([group('favourite-s1', ['a', 'b'], 2, true), group('favourite-s1', ['b', 'c'], 2, true)]);

        expect(merged).toHaveLength(1);
        expect(merged[0].count).toBe(4);
        expect(merged[0].accounts.map(a => a.id)).toEqual(['a', 'b', 'c']);
    });

    it('keeps the first copy of a v2 group, which already has its full count', () => {
        const merged = mergeGroups([group('favourite-s1', ['a', 'b'], 6), group('favourite-s1', ['c'], 6)]);

        expect(merged).toEqual([group('favourite-s1', ['a', 'b'], 6)]);
    });
});
