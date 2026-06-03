import apiClient from "../api/client";

export interface AppRegistrationData {
    client_id: string;
    client_secret: string;
}

export async function registerApp(instanceUrl: string, redirectUri: string): Promise<AppRegistrationData> {
    const response = await apiClient.post<AppRegistrationData>(
        `${instanceUrl}/api/v1/apps`,
        {
            client_name: 'Pugdom',
            redirect_uris: redirectUri,
            scopes: 'read write follow push',
            website: 'https://github.com/cajuuh/pugdomv2'
        }
    );
    return response.data;
}