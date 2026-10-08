import { AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import { DeviceEventEmitter } from 'react-native';
import apiClient, { publicClient, UNAUTHORIZED_EVENT } from '../services/api/client';
import { getCredentials } from '../services/storage';
import { createStatus, CreateStatusParams } from '../services/mastodon/statuses';

jest.mock('../services/storage', () => ({
    getCredentials: jest.fn(),
}));

const mockedGetCredentials = getCredentials as jest.MockedFunction<typeof getCredentials>;

// Adapter that echoes the final request config instead of hitting the network
const echoAdapter = async (config: InternalAxiosRequestConfig) => ({
    data: config,
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
});

const unauthorizedAdapter = async (config: InternalAxiosRequestConfig) => {
    const response = { data: {}, status: 401, statusText: 'Unauthorized', headers: {}, config };
    throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, null, response);
};

describe('apiClient', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedGetCredentials.mockResolvedValue({
            accessToken: 'active-token',
            instanceUrl: 'https://mastodon.social',
        });
        apiClient.defaults.adapter = echoAdapter;
        publicClient.defaults.adapter = echoAdapter;
    });

    it('authenticates relative requests against the active instance', async () => {
        const { data: config } = await apiClient.get('/timelines/home');
        expect(config.baseURL).toBe('https://mastodon.social/api/v1');
        expect(AxiosHeaders.from(config.headers).get('Authorization')).toBe('Bearer active-token');
    });

    it('authenticates absolute requests to the active instance', async () => {
        const { data: config } = await apiClient.get('https://MASTODON.social/api/v2/instance');
        expect(AxiosHeaders.from(config.headers).get('Authorization')).toBe('Bearer active-token');
    });

    it('never sends the token to another instance', async () => {
        const { data: config } = await apiClient.post('https://evil.example/api/v1/apps', {});
        expect(config.baseURL).toBeUndefined();
        expect(AxiosHeaders.from(config.headers).get('Authorization')).toBeFalsy();
    });

    it('does not treat a lookalike host as the active instance', async () => {
        const { data: config } = await apiClient.get('https://mastodon.social.evil.example/api/v1/accounts');
        expect(AxiosHeaders.from(config.headers).get('Authorization')).toBeFalsy();
    });

    it('supports plain http instances for relative requests', async () => {
        mockedGetCredentials.mockResolvedValue({ accessToken: 'token', instanceUrl: 'http://localhost:3000' });
        const { data: config } = await apiClient.get('/accounts/verify_credentials');
        expect(config.baseURL).toBe('http://localhost:3000/api/v1');
    });

    it('publicClient never attaches the stored token', async () => {
        const { data: config } = await publicClient.post('https://other.instance/oauth/token', {});
        expect(mockedGetCredentials).not.toHaveBeenCalled();
        expect(AxiosHeaders.from(config.headers).get('Authorization')).toBeFalsy();
    });

    it("serializes array params as Mastodon's name[]=value", async () => {
        const { data: config } = await apiClient.get('/notifications', { params: { types: ['mention', 'follow'] } });
        const query = decodeURIComponent(apiClient.getUri(config).split('?')[1]);
        expect(query).toBe('types[]=mention&types[]=follow');
    });

    describe('401 handling', () => {
        let listener: jest.Mock;
        let subscription: { remove: () => void };

        beforeEach(() => {
            listener = jest.fn();
            subscription = DeviceEventEmitter.addListener(UNAUTHORIZED_EVENT, listener);
            apiClient.defaults.adapter = unauthorizedAdapter;
        });

        afterEach(() => subscription.remove());

        it('emits the rejected token when the active instance returns 401', async () => {
            await expect(apiClient.get('/timelines/home')).rejects.toThrow('Unauthorized');
            expect(listener).toHaveBeenCalledWith({ accessToken: 'active-token' });
        });

        it('ignores 401s from other servers', async () => {
            await expect(apiClient.get('https://other.instance/api/v1/statuses/1')).rejects.toThrow('Unauthorized');
            expect(listener).not.toHaveBeenCalled();
        });
    });

    describe('dropped connections', () => {
        // Fails the first call the given way, then answers
        const flakyAdapter = (code: string) => {
            const calls: InternalAxiosRequestConfig[] = [];
            const adapter = async (config: InternalAxiosRequestConfig) => {
                calls.push(config);
                if (calls.length === 1) throw new AxiosError(code === 'ERR_NETWORK' ? 'Network Error' : 'timeout', code, config, {});
                return echoAdapter(config);
            };
            return { adapter, calls };
        };

        it('sends a request once more when it got no answer at all, on both clients', async () => {
            for (const client of [apiClient, publicClient]) {
                const { adapter, calls } = flakyAdapter('ERR_NETWORK');
                client.defaults.adapter = adapter;

                await expect(client.post('https://mastodon.social/api/v1/statuses', {})).resolves.toMatchObject({ status: 200 });
                expect(calls).toHaveLength(2);
            }
        });

        it("doesn't retry twice, or retry a timeout that may have reached the server", async () => {
            apiClient.defaults.adapter = async config => {
                throw new AxiosError('Network Error', 'ERR_NETWORK', config, {});
            };
            await expect(apiClient.get('/timelines/home')).rejects.toThrow('Network Error');

            const { adapter, calls } = flakyAdapter('ECONNABORTED');
            apiClient.defaults.adapter = adapter;
            await expect(apiClient.post('/statuses', {})).rejects.toThrow('timeout');
            expect(calls).toHaveLength(1);
        });

        it("posts with an Idempotency-Key, so a retry can't post twice", async () => {
            const { adapter, calls } = flakyAdapter('ERR_NETWORK');
            apiClient.defaults.adapter = adapter;

            await createStatus({ status: 'hi' } as CreateStatusParams);

            const keys = calls.map(config => config.headers['Idempotency-Key']);
            expect(keys[0]).toBeTruthy();
            expect(keys[1]).toBe(keys[0]);
        });
    });
});
