import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils/queryClient';
import { NotificationRow } from '../screens/Notifications/notifications';
import { groupsFromNotifications, groupsFromV2 } from '../services/mastodon/notifications';
import { routeForNotification } from '../services/push';
import { SUPPORTED_NOTIFICATION_TYPES } from '../hooks/useNotifications';
import { NavigationProvider, useNavigator } from '../services/navigationContext';
import { Account, Collection, Notification } from '../services/mastodon/types';

jest.mock('../services/api/client', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() }, publicClient: { get: jest.fn() } }));
jest.mock('../services/authContext', () => ({ useAuth: () => ({ user: { id: 'me' } }), useOptionalAuth: () => ({ user: { id: 'me' } }) }));
jest.mock('../services/themeContext', () => ({ useTheme: () => jest.requireActual('../testUtils/theme').mockTheme }));
jest.mock('../services/settingsContext', () => ({ useOptionalSettings: () => null, useSettings: () => ({ hideCounts: false }) }));
jest.mock('../services/composeContext', () => ({ useCompose: () => ({ openCompose: jest.fn() }) }));
jest.mock('../components/MediaViewer/mediaViewer', () => ({ useMediaViewer: () => ({ openMedia: jest.fn() }) }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(() => Promise.resolve()) }));

const ana: Account = { id: 'ana', username: 'ana', acct: 'ana@pug.social', display_name: 'Ana', avatar: '', emojis: [] };
const pugArtists = { id: 'c1', account_id: 'ana', name: 'Pug artists', items: [], item_count: 3 } as unknown as Collection;
const added: Notification = { id: '50', type: 'added_to_collection', created_at: new Date().toISOString(), account: ana, collection: pugArtists };

const StackProbe = () => <Text testID="stack">{JSON.stringify(useNavigator().stack.map(entry => entry.route))}</Text>;
const wrap = (children: React.ReactNode) => (
    <QueryClientProvider client={createTestQueryClient()}>
        <NavigationProvider>
            {children}
            <StackProbe />
        </NavigationProvider>
    </QueryClientProvider>
);

describe('collection notifications (Mastodon 4.6)', () => {
    it('are asked for, so the server sends them', () => {
        expect(SUPPORTED_NOTIFICATION_TYPES).toEqual(expect.arrayContaining(['added_to_collection', 'collection_update']));
    });

    it('keep their collection in rows from v1 and v2', () => {
        expect(groupsFromNotifications([added])[0].collection).toBe(pugArtists);
        const [group] = groupsFromV2({
            accounts: [ana],
            statuses: [],
            notification_groups: [{ group_key: 'ungrouped-50', notifications_count: 1, type: 'collection_update', most_recent_notification_id: '50', sample_account_ids: ['ana'], collection: pugArtists }],
        });
        expect(group).toMatchObject({ type: 'collection_update', collection: pugArtists, accounts: [ana] });
    });

    it('open the collection when their push is tapped', () => {
        expect(routeForNotification(added)).toEqual({ name: 'collection', collectionId: 'c1', collection: pugArtists });
    });

    it('show who and which collection, and open it', async () => {
        await render(wrap(<NotificationRow group={groupsFromNotifications([added])[0]} />));
        expect(screen.getByText(/added you to a collection/)).toBeTruthy();
        expect(screen.getByText('Pug artists')).toBeTruthy();

        await fireEvent.press(screen.getByText('Pug artists'));
        expect(JSON.parse(String(screen.getByTestId('stack').props.children))).toEqual([{ name: 'collection', collectionId: 'c1', collection: pugArtists }]);
    });

    it('say when a collection you are in changed', async () => {
        await render(wrap(<NotificationRow group={groupsFromNotifications([{ ...added, type: 'collection_update' }])[0]} />));
        expect(screen.getByText(/updated a collection you’re in/)).toBeTruthy();
    });
});
