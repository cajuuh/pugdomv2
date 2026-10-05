import apiClient from '../services/api/client';
import { resolveAccount } from '../services/mastodon/search';

jest.mock('../services/api/client', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('../services/storage', () => ({
    getCredentials: jest.fn().mockResolvedValue({ accessToken: 't', instanceUrl: 'https://pug.social' }),
}));

const mockedGet = apiClient.get as jest.Mock;

describe('resolveAccount', () => {
    it('asks our server to look the account up, on the v2 search endpoint', async () => {
        mockedGet.mockResolvedValue({ data: { accounts: [{ id: 'ana' }], statuses: [], hashtags: [] } });

        const account = await resolveAccount('https://art.social/@ana');

        expect(mockedGet).toHaveBeenCalledWith('https://pug.social/api/v2/search', {
            params: { q: 'https://art.social/@ana', type: 'accounts', resolve: true, limit: 1 },
        });
        expect(account).toEqual({ id: 'ana' });
    });

    it('is null when nothing matches', async () => {
        mockedGet.mockResolvedValue({ data: { accounts: [] } });
        expect(await resolveAccount('@nobody@nowhere.social')).toBeNull();
    });
});
