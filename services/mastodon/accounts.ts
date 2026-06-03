import apiClient from "../api/client";

export interface Account {
    id: string;
    username: string;
    display_name: string;
    avatar: string;
}

export async function getCurrentAccount(): Promise<Account> {
    const response = await apiClient.get<Account>('/accounts/verify_credentials');
    return response.data;
}