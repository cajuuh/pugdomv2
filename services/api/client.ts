import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { DeviceEventEmitter } from 'react-native';
import { getCredentials } from '../storage';

// Emitted with { accessToken } when the active instance rejects our token
export const UNAUTHORIZED_EVENT = 'api_unauthorized';

const ABSOLUTE_URL = /^https?:\/\//i;

const getOrigin = (url: string) => url.match(/^https?:\/\/[^/?#]+/i)?.[0].toLowerCase() ?? null;

// Token used to authenticate a request, so a 401 can be traced back to the account that sent it
type AuthedRequestConfig = InternalAxiosRequestConfig & { pugdomAccessToken?: string };

const apiClient = axios.create({
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    }
});

// Unauthenticated client for OAuth and app registration, which talk to instances we may not be logged into
export const publicClient = axios.create({
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    }
});

// Android keeps idle connections for reuse, but the server may have closed one already: a request sent
// on it fails with no answer ("Network Error"), and Android only retries GETs by itself. So such a
// failure is sent once more. Timeouts aren't, since those may have reached the server; posting also
// carries an Idempotency-Key, so a post that did arrive isn't made twice.
type RetriedRequestConfig = InternalAxiosRequestConfig & { pugdomRetried?: boolean };
export const retryDroppedConnection = (client: AxiosInstance) => (error: unknown) => {
    const config = axios.isAxiosError(error) ? (error.config as RetriedRequestConfig | undefined) : undefined;
    if (axios.isAxiosError(error) && !error.response && error.code === 'ERR_NETWORK' && config && !config.pugdomRetried) {
        config.pugdomRetried = true;
        return client.request(config);
    }
    return Promise.reject(error);
};
publicClient.interceptors.response.use(undefined, retryDroppedConnection(publicClient));

// Request interceptor added to dynamically inject instance and auth token
apiClient.interceptors.request.use(
    async (config: AuthedRequestConfig) => {
        const { accessToken, instanceUrl } = await getCredentials();
        if (!instanceUrl) {
            return config;
        }

        const isAbsolute = ABSOLUTE_URL.test(config.url ?? '');
        if (!isAbsolute) {
            config.baseURL = `${instanceUrl}/api/v1`;
        }

        // Never send the token to a different server than the one it belongs to
        const targetsActiveInstance = !isAbsolute || getOrigin(config.url!) === getOrigin(instanceUrl);
        if (accessToken && targetsActiveInstance && !config.headers.Authorization) {
            config.headers.Authorization = `Bearer ${accessToken}`;
            config.pugdomAccessToken = accessToken;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor to catch auth errors
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const accessToken = (error.config as AuthedRequestConfig | undefined)?.pugdomAccessToken;
        if (error.response?.status === 401 && accessToken) {
            DeviceEventEmitter.emit(UNAUTHORIZED_EVENT, { accessToken });
        }
        return Promise.reject(error);
    }
)

apiClient.interceptors.response.use(undefined, retryDroppedConnection(apiClient));

export default apiClient;
