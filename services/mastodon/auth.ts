import apiClient from "../api/client";

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
    const response = await apiClient.post<TokenResponse>(
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