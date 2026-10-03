import apiClient from '../api/client';
import { getCredentials } from '../storage';
import { Account } from './types';

// Finds the account behind a profile URL or @user@server, asking our server to look it up (WebFinger)
// if it doesn't know it yet. Null when nothing matches.
export async function resolveAccount(query: string): Promise<Account | null> {
    // apiClient's base URL is /api/v1, so the v2 endpoint needs the full URL
    const { instanceUrl } = await getCredentials();
    if (!instanceUrl) return null;
    const response = await apiClient.get<{ accounts: Account[] }>(`${instanceUrl}/api/v2/search`, {
        params: { q: query, type: 'accounts', resolve: true, limit: 1 },
    });
    return response.data.accounts?.[0] ?? null;
}
