import { publicClient } from '../api/client';
import { getCredentials } from '../storage';
import { Status } from './types';

// "https://Art.Social/" or "@art.social" → "art.social"
export const normalizeDomain = (input: string) =>
    input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^@/, '').replace(/\/.*$/, '');

export const isDomain = (domain: string) => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain);

export interface ServerInfo {
    domain: string;
    title: string;
    description?: string;
    thumbnail?: string;
}

export type ServerCheck =
    | { ok: true; server: ServerInfo }
    | { ok: false; reason: 'invalid' | 'own' | 'unreachable' | 'private' };

// Anonymous: nothing from our account goes to the other server
const serverUrl = (domain: string, path: string) => `https://${domain}/api${path}`;

// A server's local timeline, read without an account (newest first)
export async function getServerTimeline(domain: string, maxId?: string, sinceId?: string, limit?: number): Promise<Status[]> {
    const response = await publicClient.get<Status[]>(serverUrl(domain, '/v1/timelines/public'), {
        params: { local: true, max_id: maxId, since_id: sinceId, limit },
    });
    return response.data;
}

// Can we show this server's timeline? Its name and description, or why not
export async function checkServer(input: string): Promise<ServerCheck> {
    const domain = normalizeDomain(input);
    if (!isDomain(domain)) return { ok: false, reason: 'invalid' };
    // Our own server's timeline is already the Local feed
    const { instanceUrl } = await getCredentials();
    if (instanceUrl && normalizeDomain(instanceUrl) === domain) return { ok: false, reason: 'own' };

    let server: ServerInfo = { domain, title: domain };
    try {
        const { data } = await publicClient.get<{ title?: string; description?: string; thumbnail?: { url?: string } }>(serverUrl(domain, '/v2/instance'));
        server = { domain, title: data.title || domain, description: data.description, thumbnail: data.thumbnail?.url };
    } catch (error: any) {
        // No answer at all: not a server (or it's down)
        if (!error?.response) return { ok: false, reason: 'unreachable' };
    }

    try {
        await getServerTimeline(domain, undefined, undefined, 1);
        return { ok: true, server };
    } catch (error: any) {
        const status = error?.response?.status;
        // Servers can hide their public timeline from people without an account there
        if (status === 401 || status === 403 || status === 422) return { ok: false, reason: 'private' };
        return { ok: false, reason: 'unreachable' };
    }
}
