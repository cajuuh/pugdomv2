import { AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import { DeviceEventEmitter } from 'react-native';
import apiClient, { publicClient, UNAUTHORIZED_EVENT } from '../services/api/client';
import { getCredentials } from '../services/storage';

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
});
