import apiClient from '../api/client';
import { CustomEmoji } from './types';

// The instance's custom emoji, including ones hidden from pickers
export async function fetchCustomEmojis(): Promise<CustomEmoji[]> {
    const response = await apiClient.get('/custom_emojis');
    return response.data;
}
