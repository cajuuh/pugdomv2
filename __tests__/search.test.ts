import apiClient from '../services/api/client';
import { resolveAccount, searchAccountNames } from '../services/mastodon/search';

jest.mock('../services/api/client', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('../services/storage', () => ({
    getCredentials: jest.fn().mockResolvedValue({ accessToken: 't', instanceUrl: 'https://pug.social' }),
}));

const mockedGet = apiClient.get as jest.Mock;

describe('searchAccountNames', () => {
    it("asks the autocomplete search, which doesn't look in bios, and only sends the filters in use", async () => {
        mockedGet.mockResolvedValue({ data: [{ id: 'isa' }] });

        expect(await searchAccountNames('isa', { following: true, limit: 20 })).toEqual([{ id: 'isa' }]);
        expect(mockedGet).toHaveBeenCalledWith('/accounts/search', { params: { q: 'isa', following: true, resolve: undefined, limit: 20 } });

        await searchAccountNames('isa@far.social', { resolve: true });
        expect(mockedGet).toHaveBeenCalledWith('/accounts/search', { params: { q: 'isa@far.social', following: undefined, resolve: true, limit: undefined } });
    });
});

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
