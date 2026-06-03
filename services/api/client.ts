import axios from 'axios';
import { getCredentials } from '../storage';

const apiClient = axios.create({
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    }
});

// Request interceptor added to dynamically inject instance and wuth token
apiClient.interceptors.request.use(
    async (config) => {
        const { accessToken, instanceUrl } = await getCredentials();
        if (instanceUrl && !config.url?.startsWith('https')) {
            config.baseURL = `${instanceUrl}/api/v1`
        }
        if (accessToken && !config.headers.Authorization) {
            config.headers.Authorization = `Bearer ${accessToken}`
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response intercepetor to catch auth errors
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401) {
            //redirect to login screen
        }
        return Promise.reject(error);
    }
)

export default apiClient;