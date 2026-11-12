import { publicClient } from '../services/api/client';
import { finishSignIn } from '../services/mastodon/auth';
import { getCredentials, savePendingSignIn } from '../services/storage';

const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
    getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => { mockStore.set(key, value); }),
    deleteItemAsync: jest.fn(async (key: string) => { mockStore.delete(key); }),
}));
jest.mock('../services/api/client', () => ({
    __esModule: true,
    default: {},
    publicClient: { post: jest.fn() },
}));

const mockedPost = publicClient.post as jest.Mock;
const pending = { instanceUrl: 'https://mastodon.social', clientId: 'id', clientSecret: 'secret', redirectUri: 'pugdom://redirect' };

beforeEach(() => {
    mockStore.clear();
    mockedPost.mockReset().mockResolvedValue({ data: { access_token: 'token' } });
});

describe('finishSignIn', () => {
    it('finishes a saved sign-in from the redirect after a restart', async () => {
        await savePendingSignIn(pending);
        await expect(finishSignIn('pugdom://redirect?code=abc')).resolves.toEqual({ accessToken: 'token', instanceUrl: 'https://mastodon.social' });
        expect(mockedPost).toHaveBeenCalledWith('https://mastodon.social/oauth/token', expect.objectContaining({
            client_id: 'id', client_secret: 'secret', code: 'abc', redirect_uri: 'pugdom://redirect',
        }));
        await expect(getCredentials()).resolves.toEqual({ accessToken: 'token', instanceUrl: 'https://mastodon.social' });
        // Used once
        await expect(finishSignIn('pugdom://redirect?code=def')).resolves.toBeNull();
    });

    it('does nothing without a saved sign-in, a code or the right redirect', async () => {
        await expect(finishSignIn('pugdom://redirect?code=one')).resolves.toBeNull();
        await expect(finishSignIn(null)).resolves.toBeNull();
        await savePendingSignIn(pending);
        await expect(finishSignIn('pugdom://redirect')).resolves.toBeNull();
        await expect(finishSignIn('pugdom://other?code=two')).resolves.toBeNull();
        expect(mockedPost).not.toHaveBeenCalled();
    });

    it('exchanges a code once when the sign-in screen and the restarted app both get it', async () => {
        await savePendingSignIn(pending);
        const results = await Promise.all([finishSignIn('pugdom://redirect?code=same'), finishSignIn('pugdom://redirect?code=same')]);
        expect(results.filter(Boolean)).toHaveLength(1);
        expect(mockedPost).toHaveBeenCalledTimes(1);
    });
});
