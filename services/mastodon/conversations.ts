import apiClient from '../api/client';
import { nextMaxIdFromLink } from './bookmarks';
import { Account, Status } from './types';

// A direct conversation: the other people in it, its newest post, and whether you've read it
export interface Conversation {
    id: string;
    unread: boolean;
    accounts: Account[];
    last_status: Status | null;
}

export interface ConversationsPage {
    conversations: Conversation[];
    // Older conversations, from the Link header (their cursor isn't a conversation id)
    nextMaxId?: string;
}

// Newest activity first
export async function getConversations(maxId?: string): Promise<ConversationsPage> {
    const response = await apiClient.get<Conversation[]>('/conversations', { params: { max_id: maxId } });
    return { conversations: response.data, nextMaxId: nextMaxIdFromLink(response.headers?.link) };
}

export async function markConversationRead(id: string): Promise<Conversation> {
    const response = await apiClient.post<Conversation>(`/conversations/${id}/read`);
    return response.data;
}
