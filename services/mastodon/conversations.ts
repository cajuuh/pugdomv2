import apiClient from '../api/client';
import { nextMaxIdFromLink } from './bookmarks';
import { Account, Status } from './types';
import { plainText } from '../htmlText';

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

// Who a conversation is with (Mastodon leaves accounts empty when it's only you)
export const conversationPeople = (conversation: Conversation): Account[] =>
    conversation.accounts.length ? conversation.accounts : conversation.last_status ? [conversation.last_status.account] : [];

// A post as one line of preview: its content warning when it has one
export const statusPreview = (status: Status) =>
    status.spoiler_text ? `⚠ ${status.spoiler_text}` : plainText(status.content).replace(/\s+/g, ' ');

// Mastodon makes a conversation per thread; pugdon shows one per set of people, with its threads newest first
export interface ConversationGroup {
    key: string;
    people: Account[];
    threads: Conversation[];
    unread: boolean;
}

// Keeps the server's order (newest activity first): a group sits where its newest thread would
export function groupConversations(conversations: Conversation[]): ConversationGroup[] {
    const groups = new Map<string, ConversationGroup>();
    conversations.forEach(conversation => {
        const people = conversationPeople(conversation);
        const key = people.length ? people.map(account => account.id).sort().join(',') : conversation.id;
        const group = groups.get(key);
        if (group) {
            group.threads.push(conversation);
            group.unread = group.unread || conversation.unread;
        } else {
            groups.set(key, { key, people, threads: [conversation], unread: conversation.unread });
        }
    });
    return [...groups.values()];
}
