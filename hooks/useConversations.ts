import { InfiniteData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useOptionalAuth } from '../services/authContext';
import { Conversation, ConversationsPage, getConversations, markConversationRead } from '../services/mastodon/conversations';
import { unreadConversationsKey } from './useUnreadConversations';

export const conversationsKey = (accountId: string) => ['conversations', accountId];

const MARK_READ_BATCH = 4;

// Your direct conversations, shared by Messages and a person's conversations, and marking them read
export const useConversations = () => {
    const queryClient = useQueryClient();
    const me = useOptionalAuth()?.user;
    const key = conversationsKey(me?.id ?? '');

    const query = useInfiniteQuery({
        queryKey: key,
        queryFn: ({ pageParam }) => getConversations(pageParam),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (page: ConversationsPage) => page.nextMaxId,
    });
    const conversations = query.data?.pages.flatMap(page => page.conversations) ?? [];

    const setUnread = (ids: string[], unread: boolean) =>
        queryClient.setQueryData<InfiniteData<ConversationsPage>>(key, current =>
            current && {
                ...current,
                pages: current.pages.map(page => ({
                    ...page,
                    conversations: page.conversations.map(item => (ids.includes(item.id) ? { ...item, unread } : item)),
                })),
            }
        );

    // Read at once here; the ones the server refuses get their dot back, and the envelope checks again.
    // Resolves the HTTP status of each failure (undefined when the request never got an answer).
    const markRead = async (ids: string[]) => {
        setUnread(ids, false);
        const failed: { id: string; status?: number }[] = [];
        // Mastodon has no "read all": one request each, a few at a time so a long list doesn't trip the rate limit
        for (let start = 0; start < ids.length; start += MARK_READ_BATCH) {
            const batch = ids.slice(start, start + MARK_READ_BATCH);
            const results = await Promise.allSettled(batch.map(markConversationRead));
            results.forEach((result, n) => {
                if (result.status === 'fulfilled') return;
                console.warn('Marking the conversation read failed:', result.reason);
                failed.push({ id: batch[n], status: result.reason?.response?.status });
            });
        }
        if (failed.length) setUnread(failed.map(item => item.id), true);
        queryClient.invalidateQueries({ queryKey: unreadConversationsKey(me?.id ?? '') });
        return failed;
    };

    // Shows a conversation's thread, marking it read
    const open = (conversation: Conversation, onStatusPress: (id: string) => void) => {
        if (!conversation.last_status) return;
        if (conversation.unread) markRead([conversation.id]);
        onStatusPress(conversation.last_status.id);
    };

    return { query, conversations, markRead, open, me };
};
