import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useOptionalAuth } from '../services/authContext';
import { getCredentials } from '../services/storage';
import { fetchInstanceConfiguration } from '../services/mastodon/instance';
import { socketUrl, StreamEvent, streaming } from '../services/mastodon/streaming';
import { Status } from '../services/mastodon/types';
import { useRemoveCachedStatus, useUpdateCachedStatus } from './useUpdateCachedStatus';

interface StreamHandlers {
    update: (status: Status) => void;
    remove: (id: string) => void;
    notified: () => void;
}

// What every screen cares about, whichever stream it came on. New posts are the feeds' own business.
export const handleStreamEvent = (event: StreamEvent, handlers: StreamHandlers) => {
    switch (event.event) {
        case 'delete':
            if (event.payload) handlers.remove(event.payload);
            break;
        case 'status.update':
            if (event.payload) handlers.update(JSON.parse(event.payload));
            break;
        case 'notification':
        case 'notifications_merged':
            handlers.notified();
            break;
    }
};

// Live updates while the app is on screen and signed in. Away, the socket closes; the periodic
// checks catch up when it's back.
export const useStreaming = (enabled: boolean) => {
    const queryClient = useQueryClient();
    const accountId = useOptionalAuth()?.user?.id;
    const update = useUpdateCachedStatus();
    const remove = useRemoveCachedStatus();
    const [foreground, setForeground] = useState(AppState.currentState !== 'background');

    useEffect(() => {
        const subscription = AppState.addEventListener('change', state => setForeground(state !== 'background'));
        return () => subscription.remove();
    }, []);

    useEffect(() => {
        if (!enabled || !accountId || !foreground) return;
        let stopped = false;
        (async () => {
            const { accessToken, instanceUrl } = await getCredentials();
            const configuration = await queryClient
                .fetchQuery({ queryKey: ['instance', 'configuration'], queryFn: fetchInstanceConfiguration, staleTime: 60 * 60 * 1000 })
                .catch(() => null);
            const base = configuration?.streamingUrl || instanceUrl;
            if (!stopped && accessToken && base) streaming.start(socketUrl(base), accessToken);
        })().catch(error => console.warn('Starting the stream failed:', error));
        return () => {
            stopped = true;
            streaming.stop();
        };
    }, [enabled, accountId, foreground, queryClient]);

    useEffect(() => {
        if (!enabled) return;
        // Notifications come on `user`, so it stays on whichever feed is open
        const unsubscribe = streaming.subscribe({ stream: 'user' });
        const unlisten = streaming.listen(event =>
            handleStreamEvent(event, {
                update,
                remove,
                notified: () => {
                    queryClient.invalidateQueries({ queryKey: ['notifications'] });
                    queryClient.invalidateQueries({ queryKey: ['unreadNotifications'] });
                },
            })
        );
        return () => {
            unsubscribe();
            unlisten();
        };
    }, [enabled, queryClient, update, remove]);
};
