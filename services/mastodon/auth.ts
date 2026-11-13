import { publicClient } from "../api/client";
import { saveCredentials, takePendingSignIn } from "../storage";

export interface TokenResponse {
    access_token: string;
    token_type: string;
    scope: string;
    created_at: number;
}

export async function exchangeCodeForToken(
    instanceUrl: string,
    clientId: string,
    clientSecret: string,
    code: string,
    redirectUri: string
): Promise<TokenResponse> {
    const response = await publicClient.post<TokenResponse>(
        `${instanceUrl}/oauth/token`,
        {
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            code,
            grant_type: 'authorization_code',
        }
    );
    return response.data;
}
// Codes already being exchanged: the redirect can reach both the waiting sign-in screen and a
// restarted app, and a code only works once
const claimedCodes = new Set<string>();

// Finishes the sign-in a server redirect (`<redirectUri>?code=…`) belongs to: exchanges the code
// and saves the token as the active account. Null when the link isn't a redirect for the saved
// pending sign-in, or the code is already handled
export async function finishSignIn(url: string | null): Promise<{ accessToken: string; instanceUrl: string } | null> {
    const code = url?.match(/[?&]code=([^&#]+)/)?.[1];
    if (!url || !code || claimedCodes.has(code)) return null;
    claimedCodes.add(code);
    const pending = await takePendingSignIn();
    if (!pending || !url.startsWith(pending.redirectUri)) return null;
    const token = await exchangeCodeForToken(pending.instanceUrl, pending.clientId, pending.clientSecret, decodeURIComponent(code), pending.redirectUri);
    await saveCredentials(token.access_token, pending.instanceUrl);
    return { accessToken: token.access_token, instanceUrl: pending.instanceUrl };
}
