import axios from 'axios';
import { publicClient } from "../api/client";

export interface AppRegistrationData {
    client_id: string;
    client_secret: string;
}

export async function registerApp(instanceUrl: string, redirectUri: string): Promise<AppRegistrationData> {
    const response = await publicClient.post<AppRegistrationData>(
        `${instanceUrl}/api/v1/apps`,
        {
            client_name: 'pugdon',
            redirect_uris: redirectUri,
            scopes: 'read write follow push',
            website: 'https://github.com/cajuuh/pugdomv2'
        }
    );
    return response.data;
}

// The address typed at sign-in isn't a Mastodon server, or can't be reached at all
export class ServerError extends Error {
    // `detail` keeps what actually went wrong (DNS, timeout, TLS...) for the logs
    constructor(public reason: 'notMastodon' | 'unreachable', public server: string, detail?: string) {
        super(detail ? `${reason} (${server}): ${detail}` : `${reason} (${server})`);
    }
}

const hostOf = (instanceUrl: string) => instanceUrl.replace(/^https?:\/\//, '');

// Registers, or says the address answered but isn't Mastodon (a 404 page, or no app back)
const tryRegister = async (instanceUrl: string, redirectUri: string): Promise<AppRegistrationData | null> => {
    try {
        const app = await registerApp(instanceUrl, redirectUri);
        return app?.client_id ? app : null;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            if (!error.response) throw new ServerError('unreachable', hostOf(instanceUrl), `${error.code ?? ''} ${error.message}`.trim());
            if (error.response.status === 404 || error.response.status === 405) return null;
        }
        throw error;
    }
};

// Handles can use a domain whose Mastodon runs elsewhere (@you@vivaldi.net lives on
// social.vivaldi.net); host-meta on the handle's domain points to the server
export async function findServerFromHostMeta(instanceUrl: string): Promise<string | null> {
    try {
        const { data } = await publicClient.get<string>(`${instanceUrl}/.well-known/host-meta`, { responseType: 'text' });
        const server = /template="(https:\/\/[^/"]+)\//.exec(String(data))?.[1];
        return server && server !== instanceUrl ? server : null;
    } catch {
        return null;
    }
}

// Registers pugdon on the server at this address, or on the one its host-meta points to.
// Returns the server's address too, since that's where sign-in continues.
export async function registerOnServer(instanceUrl: string, redirectUri: string): Promise<{ instanceUrl: string; app: AppRegistrationData }> {
    const app = await tryRegister(instanceUrl, redirectUri);
    if (app) return { instanceUrl, app };
    const server = await findServerFromHostMeta(instanceUrl);
    const serverApp = server ? await tryRegister(server, redirectUri) : null;
    if (server && serverApp) return { instanceUrl: server, app: serverApp };
    throw new ServerError('notMastodon', hostOf(instanceUrl));
}
