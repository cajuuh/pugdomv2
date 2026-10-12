import apiClient from '../api/client';

// The account's preferences set on the web (read-only through the API), e.g. reading:expand:spoilers
export type Preferences = Record<string, unknown>;

export async function getPreferences(): Promise<Preferences> {
    const response = await apiClient.get<Preferences>('/preferences');
    return response.data;
}
