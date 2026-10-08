import { useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useOptionalAuth } from '../services/authContext';
import { getConversations } from '../services/mastodon/conversations';

export const UNREAD_CONVERSATIONS_INTERVAL_MS = 3 * 60_000;
export const unreadConversationsKey = (accountId: string) => ['unreadConversations', accountId];

// Only pause in the background: at launch the state can still be 'unknown'
const isForeground = (state: AppStateStatus | null) => state !== 'background';

// Whether the envelope gets a dot: any unread conversation on the first page (newest activity
// first, so a new message is always there). Checks every three minutes in the foreground.
export const useUnreadConversations = () => {
    const accountId = useOptionalAuth()?.user?.id;
    const [active, setActive] = useState(isForeground(AppState.currentState));

    useEffect(() => {
        const subscription = AppState.addEventListener('change', state => setActive(isForeground(state)));
        return () => subscription.remove();
    }, []);

    const { data } = useQuery({
        queryKey: unreadConversationsKey(accountId ?? ''),
        queryFn: async () => (await getConversations()).conversations.some(conversation => conversation.unread),
        enabled: !!accountId && active,
        refetchInterval: active ? UNREAD_CONVERSATIONS_INTERVAL_MS : false,
        refetchOnWindowFocus: true,
    });

    return !!data;
};
