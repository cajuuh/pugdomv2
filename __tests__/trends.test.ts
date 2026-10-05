import apiClient from '../services/api/client';
import {
    getLinkTimeline,
    getSuggestions,
    getTrendingLinks,
    getTrendingStatuses,
    getTrendingTags,
    weeklyTrendUsage,
} from '../services/mastodon/trends';

jest.mock('../services/api/client', () => ({
    __esModule: true,
    default: { get: jest.fn() },
}));
jest.mock('../services/storage', () => ({
    getCredentials: jest.fn().mockResolvedValue({
        accessToken: 'token-123',
        instanceUrl: 'https://pug.social',
    }),
}));

const mockedGet = apiClient.get as jest.Mock;

describe('trends service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getTrendingStatuses', () => {
        it('fetches trending statuses with limit and offset', async () => {
            const statuses = [{ id: 's1', content: 'hello' }];
            mockedGet.mockResolvedValueOnce({ data: statuses });

            const result = await getTrendingStatuses(20, 40);

            expect(mockedGet).toHaveBeenCalledWith('/trends/statuses', {
                params: { limit: 20, offset: 40 },
            });
            expect(result).toEqual(statuses);
        });

        it('returns empty array when server returns 404 (disabled trends)', async () => {
            mockedGet.mockRejectedValueOnce({ response: { status: 404 } });
            const result = await getTrendingStatuses();
            expect(result).toEqual([]);
        });

        it('rethrows other errors', async () => {
            mockedGet.mockRejectedValueOnce(new Error('Network error'));
            await expect(getTrendingStatuses()).rejects.toThrow('Network error');
        });
    });

    describe('getTrendingTags', () => {
        it('fetches trending tags', async () => {
            const tags = [{ name: 'pugdom', url: 'https://pug.social/tags/pugdom' }];
            mockedGet.mockResolvedValueOnce({ data: tags });

            const result = await getTrendingTags(10);

            expect(mockedGet).toHaveBeenCalledWith('/trends/tags', {
                params: { limit: 10, offset: undefined },
            });
            expect(result).toEqual(tags);
        });

        it('returns empty array when server returns 404', async () => {
            mockedGet.mockRejectedValueOnce({ response: { status: 404 } });
            expect(await getTrendingTags()).toEqual([]);
        });
    });

    describe('getTrendingLinks', () => {
        it('fetches trending links', async () => {
            const links = [{ url: 'https://news.example/1', title: 'Example' }];
            mockedGet.mockResolvedValueOnce({ data: links });

            const result = await getTrendingLinks(10, 20);

            expect(mockedGet).toHaveBeenCalledWith('/trends/links', {
                params: { limit: 10, offset: 20 },
            });
            expect(result).toEqual(links);
        });

        it('returns empty array when server returns 404', async () => {
            mockedGet.mockRejectedValueOnce({ response: { status: 404 } });
            expect(await getTrendingLinks()).toEqual([]);
        });
    });

    describe('getSuggestions', () => {
        it('fetches v2 suggestions and unwraps accounts', async () => {
            const accounts = [{ id: 'a1', username: 'ana' }];
            mockedGet.mockResolvedValueOnce({
                data: [{ source: 'featured', account: accounts[0] }],
            });

            const result = await getSuggestions(20);

            expect(mockedGet).toHaveBeenCalledWith('https://pug.social/api/v2/suggestions', {
                params: { limit: 20 },
            });
            expect(result).toEqual(accounts);
        });

        it('falls back to v1 suggestions when v2 returns 404', async () => {
            const accounts = [{ id: 'a2', username: 'bob' }];
            mockedGet
                .mockRejectedValueOnce({ response: { status: 404 } })
                .mockResolvedValueOnce({ data: accounts });

            const result = await getSuggestions(20);

            expect(mockedGet).toHaveBeenNthCalledWith(1, 'https://pug.social/api/v2/suggestions', {
                params: { limit: 20 },
            });
            expect(mockedGet).toHaveBeenNthCalledWith(2, '/suggestions', {
                params: { limit: 20 },
            });
            expect(result).toEqual(accounts);
        });
    });

    describe('getLinkTimeline', () => {
        it('fetches posts sharing a link', async () => {
            const posts = [{ id: 'p1', content: 'check this out' }];
            mockedGet.mockResolvedValueOnce({ data: posts });

            const result = await getLinkTimeline('https://news.example/1', 'p0', 20);

            expect(mockedGet).toHaveBeenCalledWith('/timelines/link', {
                params: { url: 'https://news.example/1', max_id: 'p0', limit: 20 },
            });
            expect(result).toEqual(posts);
        });
    });

    describe('weeklyTrendUsage', () => {
        it('sums uses and accounts over the last 7 days', () => {
            const history = [
                { day: '1', uses: '5', accounts: '3' },
                { day: '2', uses: '10', accounts: '6' },
            ];
            expect(weeklyTrendUsage(history)).toEqual({ uses: 15, people: 9 });
        });

        it('handles empty or missing history', () => {
            expect(weeklyTrendUsage(undefined)).toEqual({ uses: 0, people: 0 });
            expect(weeklyTrendUsage([])).toEqual({ uses: 0, people: 0 });
        });
    });
});
