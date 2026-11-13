import React from 'react';
import { Dimensions, Text, View } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils/queryClient';
import Notifications from '../screens/Notifications/notifications';
import { clearNotifications, dismissNotificationGroup, groupsFromNotifications } from '../services/mastodon/notifications';
import { dialog } from '../services/dialog';
import { authorizeFollowRequest, followAccount, getRelationships } from '../services/mastodon/accounts';
import { favouriteStatus } from '../services/mastodon/statuses';
import { markNotificationsRead } from '../services/mastodon/markers';
import { getSeenNotificationId, setSeenNotificationId } from '../services/notificationsSeen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getConversations, markConversationRead } from '../services/mastodon/conversations';
import { Account, Notification } from '../services/mastodon/types';
import { actorsText, buildListItems, notificationTime, plainText, withoutOwnMention } from '../screens/Notifications/rows';
import { makeStyles } from '../screens/Notifications/styles';
import { ThemeColors } from '../services/themeContext';
import { NavigationProvider, useNavigator } from '../services/navigationContext';

// Tests give v1-shaped lists; the screen gets them as rows, grouped the way the v1 fallback groups them.
// The v2 shape is covered in notificationGroups.test.ts.
const mockV1 = jest.fn();
jest.mock('../services/mastodon/notifications', () => {
    const actual = jest.requireActual('../services/mastodon/notifications');
    return {
        ...actual,
        fetchNotificationGroups: jest.fn(async (maxId?: string, types?: string[]) => ({
            groups: actual.groupsFromNotifications(await mockV1(maxId, types)),
            nextMaxId: undefined,
        })),
        clearNotifications: jest.fn(),
        dismissNotificationGroup: jest.fn(),
    };
});
// The server's notification policy; null: a server without it
let mockPolicy: any = null;
jest.mock('../services/mastodon/notificationRequests', () => ({
    ...jest.requireActual('../services/mastodon/notificationRequests'),
    getNotificationPolicy: jest.fn(async () => mockPolicy),
}));
jest.mock('../services/settingsContext', () => ({ useOptionalSettings: () => null, useSettings: () => ({ groupNotifications: true }) }));
jest.mock('../services/mastodon/accounts', () => ({
    followAccount: jest.fn(),
    getRelationships: jest.fn(),
    authorizeFollowRequest: jest.fn(),
    rejectFollowRequest: jest.fn(),
}));
jest.mock('../services/authContext', () => ({ useOptionalAuth: () => ({ user: { id: 'me' } }) }));
jest.mock('../services/mastodon/statuses', () => ({ favouriteStatus: jest.fn(), unfavouriteStatus: jest.fn() }));
jest.mock('../services/mastodon/markers', () => ({ markNotificationsRead: jest.fn(async () => {}), getNotificationsMarker: jest.fn(async () => mockMarker) }));
// The server's read marker; null: nothing read yet
let mockMarker: string | null = null;
jest.mock('../services/themeContext', () => ({
    useTheme: () => jest.requireActual('../testUtils/theme').mockTheme,
}));
const mockOpenMedia = jest.fn();
jest.mock('../components/MediaViewer/mediaViewer', () => ({ useMediaViewer: () => ({ openMedia: mockOpenMedia }) }));
jest.mock('../services/mastodon/conversations', () => ({ getConversations: jest.fn(), markConversationRead: jest.fn() }));
const mockOpenCompose = jest.fn();
jest.mock('../services/composeContext', () => ({
    useCompose: () => ({ openCompose: mockOpenCompose }),
}));

const mockedFetch = mockV1;
const mockedFollow = followAccount as jest.MockedFunction<typeof followAccount>;
const mockedRelationships = getRelationships as jest.MockedFunction<typeof getRelationships>;
const mockedFavourite = favouriteStatus as jest.MockedFunction<typeof favouriteStatus>;
const mockedMarkRead = markNotificationsRead as jest.MockedFunction<typeof markNotificationsRead>;

const account = (id: string, name: string, extra: Partial<Account> = {}): Account =>
    ({ id, username: name, acct: name, display_name: name, avatar: '', emojis: [], ...extra });

const notification = (id: string, type: Notification['type'], from: Account, createdAt = new Date()): Notification => ({
    id,
    type,
    created_at: createdAt.toISOString(),
    account: from,
    status: type === 'follow' || type === 'follow_request' ? undefined : ({ id: `s-${id}`, content: `<p>post ${id}</p>`, spoiler_text: '', emojis: [] } as any),
});

const relationship = (id: string, following: boolean, requested = false) => ({ id, following, requested, followed_by: true });

describe('Notifications', () => {
    let queryClient: QueryClient;

    const renderScreen = () =>
        render(
            <QueryClientProvider client={queryClient}>
                <Notifications />
            </QueryClientProvider>
        );

    beforeEach(() => {
        jest.clearAllMocks();
        queryClient = createTestQueryClient();
        mockedRelationships.mockResolvedValue([]);
        (getConversations as jest.Mock).mockResolvedValue({ conversations: [] });
        mockMarker = null;
        mockPolicy = null;
        // What earlier tests showed would count as seen
        return AsyncStorage.clear();
    });

    describe('filtered notifications', () => {
        const StackProbe = () => <Text testID="stack">{JSON.stringify(useNavigator().stack.map(entry => entry.route.name))}</Text>;
        const renderWithNavigation = () =>
            render(
                <QueryClientProvider client={queryClient}>
                    <NavigationProvider>
                        <Notifications />
                        <StackProbe />
                    </NavigationProvider>
                </QueryClientProvider>
            );
        const policy = (pending: number) => ({
            for_not_following: 'accept', for_not_followers: 'accept', for_new_accounts: 'filter', for_private_mentions: 'filter', for_limited_accounts: 'filter',
            summary: { pending_requests_count: pending, pending_notifications_count: pending * 2 },
        });

        it('shows a row when the server holds some back, and it opens them', async () => {
            mockedFetch.mockResolvedValue([]);
            mockPolicy = policy(2);
            await renderWithNavigation();

            await fireEvent.press(await screen.findByRole('button', { name: 'Filtered notifications, 2 accounts waiting' }));
            expect(screen.getByTestId('stack').props.children).toBe('["notificationRequests"]');
        });

        it('leaves the row out when nothing waits, or the server has no policy', async () => {
            mockedFetch.mockResolvedValue([notification('1', 'mention', account('a', 'alice'))]);
            mockPolicy = policy(0);
            await renderWithNavigation();
            await screen.findByText(/alice/);
            expect(screen.queryByTestId('filtered-notifications')).toBeNull();
        });
    });

    it('asks the server only for the types it can render', async () => {
        mockedFetch.mockResolvedValue([notification('1', 'mention', account('a', 'alice'))]);
        await renderScreen();

        await screen.findByText(/mentioned you/);
        expect(mockedFetch).toHaveBeenCalledWith(undefined, [
            'mention', 'status', 'reblog', 'favourite', 'follow', 'follow_request', 'quote', 'quoted_update', 'poll', 'update',
        ]);
    });

    it.each([
        ['Mentions', ['mention']],
        ['Follows', ['follow', 'follow_request']],
    ] as const)('filters %s on the server from the switcher', async (tab, types) => {
        mockedFetch.mockResolvedValue([]);
        await renderScreen();
        await screen.findByText('No notifications yet!');

        await fireEvent.press(screen.getByRole('button', { name: tab }));

        await waitFor(() => expect(mockedFetch).toHaveBeenCalledWith(undefined, types));
        expect(screen.getByRole('button', { name: tab })).toBeSelected();
        expect(screen.getByRole('button', { name: 'All' })).not.toBeSelected();
    });

    it('skips notification types it cannot render', async () => {
        mockedFetch.mockResolvedValue([
            notification('1', 'admin.sign_up', account('a', 'alice')),
            notification('2', 'favourite', account('b', 'bob')),
        ]);
        await renderScreen();

        expect(await screen.findByText(/favourited your post/)).toBeTruthy();
        expect(screen.getAllByText(/your post|mentioned you|followed you/)).toHaveLength(1);
    });

    it('shows posts from people with the bell on, edits of boosted posts, and ended polls', async () => {
        mockedFetch.mockResolvedValue([
            notification('1', 'status', account('a', 'alice')),
            notification('2', 'update', account('b', 'bob')),
            notification('3', 'poll', account('c', 'carol')),
            notification('4', 'poll', account('me', 'me')),
        ]);
        await renderScreen();

        expect(await screen.findByText(/posted$/)).toBeTruthy();
        expect(screen.getByText('post 1')).toBeTruthy();
        expect(screen.getByText(/edited a post you boosted/)).toBeTruthy();
        expect(screen.getByText('A poll you voted in has ended')).toBeTruthy();
        expect(screen.getByText('Your poll has ended')).toBeTruthy();
    });

    it('shows the results of an ended poll, and reads them out', async () => {
        const ended = notification('5', 'poll', account('c', 'carol'));
        ended.status!.poll = {
            id: 'p1', expires_at: null, expired: true, multiple: false, votes_count: 4, voters_count: 4, voted: true, own_votes: [1], emojis: [],
            options: [{ title: 'Tea', votes_count: 1 }, { title: 'Coffee', votes_count: 3 }],
        } as any;
        mockedFetch.mockResolvedValue([ended]);
        await renderScreen();

        expect(await screen.findByText('Coffee')).toBeTruthy();
        expect(screen.getByText('75%')).toBeTruthy();
        expect(screen.getByText('25%')).toBeTruthy();
        expect(screen.getByLabelText(/Tea, 25 percent, Coffee, 75 percent/)).toBeTruthy();
    });

    it('accepts a follow request from the row', async () => {
        (authorizeFollowRequest as jest.Mock).mockResolvedValue(undefined);
        mockedFetch.mockResolvedValue([notification('1', 'follow_request', account('a', 'alice'))]);
        await renderScreen();

        expect(await screen.findByText(/asked to follow you/)).toBeTruthy();
        await fireEvent.press(screen.getByRole('button', { name: 'Accept' }));

        expect(authorizeFollowRequest).toHaveBeenCalledWith('a');
        expect(await screen.findByText('Accepted')).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Reject' })).toBeNull();
    });

    it('tells a private mention apart', async () => {
        const dm = notification('1', 'mention', account('a', 'alice'));
        mockedFetch.mockResolvedValue([{ ...dm, status: { ...dm.status, visibility: 'direct' } }]);
        await renderScreen();

        expect(await screen.findByText(/privately mentioned you/)).toBeTruthy();
    });

    it('marks a direct message read when it shows here, so the envelope dot goes', async () => {
        const dm = notification('1', 'mention', account('a', 'alice'));
        mockedFetch.mockResolvedValue([{ ...dm, status: { ...dm.status, visibility: 'direct' } }]);
        (getConversations as jest.Mock).mockResolvedValue({
            conversations: [
                { id: 'c1', unread: true, accounts: [], last_status: { id: 's-1' } },
                { id: 'c2', unread: true, accounts: [], last_status: { id: 's-other' } },
            ],
        });
        await renderScreen();

        await waitFor(() => expect(markConversationRead).toHaveBeenCalledWith('c1'));
        expect(markConversationRead).not.toHaveBeenCalledWith('c2');
    });

    it('shows the pictures in a reply, which open the viewer', async () => {
        const reply = notification('1', 'mention', account('a', 'alice'));
        const picture = { id: 'm1', type: 'image', url: 'u', preview_url: 'p', description: 'A pug on a sofa' };
        mockedFetch.mockResolvedValue([{ ...reply, status: { ...reply.status, content: '<p>@me</p>', media_attachments: [picture] } }]);
        await renderScreen();

        await fireEvent.press(await screen.findByRole('imagebutton', { name: 'A pug on a sofa' }));
        expect(mockOpenMedia).toHaveBeenCalledWith([picture], 0, undefined);
    });

    it('shows the pictures of your post when someone favourites it', async () => {
        const fav = notification('1', 'favourite', account('a', 'alice'));
        const picture = { id: 'm1', type: 'image', url: 'u', preview_url: 'p', description: 'Arte' };
        mockedFetch.mockResolvedValue([{ ...fav, status: { ...fav.status, content: '<p>arte</p>', media_attachments: [picture] } }]);
        await renderScreen();

        expect(await screen.findByLabelText(/arte\. 1 photo/)).toBeTruthy();
        await fireEvent.press(screen.getByRole('imagebutton', { name: 'Arte' }));
        expect(mockOpenMedia).toHaveBeenCalledWith([picture], 0, undefined);
    });

    it('shows when someone quotes your post, with what they wrote', async () => {
        mockedFetch.mockResolvedValue([notification('1', 'quote', account('a', 'alice'))]);
        await renderScreen();

        expect(await screen.findByText(/quoted your post/)).toBeTruthy();
        expect(screen.getByText('post 1')).toBeTruthy();
    });

    it('keeps notifications cached when coming back to the tab', async () => {
        mockedFetch.mockResolvedValue([notification('1', 'mention', account('a', 'alice'))]);
        const { rerender } = await renderScreen();
        await screen.findByText(/mentioned you/);

        // The refetch on return never resolves, so the list can only come from the cache
        mockedFetch.mockReturnValue(new Promise(() => {}));

        // Leave the tab (the screen unmounts) and come back, within the same render root
        await rerender(<QueryClientProvider client={queryClient}><View /></QueryClientProvider>);
        expect(screen.queryByText(/mentioned you/)).toBeNull();
        await rerender(<QueryClientProvider client={queryClient}><Notifications /></QueryClientProvider>);

        // Rendered from cache straight away, no loading state
        expect(screen.getByText(/mentioned you/)).toBeTruthy();
    });

    it('renders custom emoji in display names', async () => {
        const emojiAccount = account('a', 'alice', {
            display_name: 'Alice :blobcat:',
            emojis: [{ shortcode: 'blobcat', url: 'https://x/blobcat.png', static_url: '', visible_in_picker: true }],
        });
        mockedFetch.mockResolvedValue([notification('1', 'mention', emojiAccount)]);
        await renderScreen();

        await screen.findByText(/mentioned you/);
        expect(screen.queryByText(/:blobcat:/)).toBeNull();
    });

    it('follows back and then shows the new state', async () => {
        mockedFetch.mockResolvedValue([notification('1', 'follow', account('b', 'bob'))]);
        mockedRelationships.mockResolvedValue([relationship('b', false)]);
        mockedFollow.mockResolvedValue(relationship('b', true));
        await renderScreen();

        await fireEvent.press(await screen.findByText('Follow back'));

        expect(mockedFollow).toHaveBeenCalledWith('b');
        // They follow you (it's a follow notification), so following back makes you mutuals
        expect(await screen.findByText('Mutuals')).toBeTruthy();
        expect(screen.queryByText('Follow back')).toBeNull();
    });

    it('does not offer to follow accounts already followed', async () => {
        mockedFetch.mockResolvedValue([notification('1', 'follow', account('b', 'bob'))]);
        mockedRelationships.mockResolvedValue([relationship('b', true)]);
        await renderScreen();

        expect(await screen.findByText('Mutuals')).toBeTruthy();
        expect(screen.queryByText('Follow back')).toBeNull();
        expect(mockedRelationships).toHaveBeenCalledWith(['b']);
    });

    it('shows Requested once a follow waits for a locked account', async () => {
        mockedFetch.mockResolvedValue([notification('1', 'follow', account('b', 'bob'))]);
        mockedRelationships.mockResolvedValue([relationship('b', false)]);
        mockedFollow.mockResolvedValue(relationship('b', false, true));
        await renderScreen();

        await fireEvent.press(await screen.findByText('Follow back'));

        expect(await screen.findByText('Requested')).toBeTruthy();
        expect(screen.queryByText('Follow back')).toBeNull();
    });

    it('groups notifications under Today and Earlier', async () => {
        const lastWeek = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
        mockedFetch.mockResolvedValue([
            notification('2', 'favourite', account('a', 'alice')),
            notification('1', 'reblog', account('b', 'bob'), lastWeek),
        ]);
        mockMarker = '2';
        await renderScreen();

        await screen.findByText(/favourited your post/);
        expect(screen.getAllByRole('header').map(header => header.props.children)).toEqual(['Notifications', 'Today', 'Earlier']);
    });

    it('puts what came after your last read under New, each with a dot, until you mark all as read', async () => {
        mockedFetch.mockResolvedValue([
            notification('3', 'favourite', account('a', 'alice')),
            notification('2', 'reblog', account('b', 'bob')),
            notification('1', 'follow', account('c', 'carol')),
        ]);
        mockMarker = '1';
        await renderScreen();

        await screen.findByText(/favourited your post/);
        expect(screen.getAllByRole('header').map(header => header.props.children)).toEqual(['Notifications', 'New', 'Today']);
        expect(screen.getAllByTestId('unread-row-dot')).toHaveLength(2);

        await fireEvent.press(screen.getByRole('button', { name: 'Mark all as read' }));
        expect(screen.getAllByRole('header').map(header => header.props.children)).toEqual(['Notifications', 'Today']);
        expect(screen.queryByTestId('unread-row-dot')).toBeNull();
    });

    // On Android an unset border width is NaN, and a rounded card clipped with it paints nothing, so a lone
    // "New" row went blank on Mark all as read. Only a device shows the blank; this keeps the widths set.
    it('keeps the top and bottom border widths set on every row, so changing section cannot unset them', () => {
        const { segment } = makeStyles({} as ThemeColors);
        expect(segment.borderTopWidth).toBe(0);
        expect(segment.borderBottomWidth).toBe(0);
    });

    it('keeps them New while you look, though opening the tab clears the bell', async () => {
        mockedFetch.mockResolvedValue([notification('2', 'favourite', account('a', 'alice'))]);
        mockMarker = '1';
        await renderScreen();

        await screen.findByText(/favourited your post/);
        await waitFor(async () => expect(await getSeenNotificationId('me')).toBe('2'));
        expect(screen.getByTestId('unread-row-dot')).toBeTruthy();
    });

    it("counts what this phone already showed you as read, even if the server's marker is older", async () => {
        mockedFetch.mockResolvedValue([
            notification('3', 'favourite', account('a', 'alice')),
            notification('2', 'reblog', account('b', 'bob')),
        ]);
        mockMarker = '1';
        await setSeenNotificationId('me', '2');
        await renderScreen();

        await screen.findByText(/favourited your post/);
        await waitFor(() => expect(screen.getAllByTestId('unread-row-dot')).toHaveLength(1));
    });

    it('marks each type with a glyph badge instead of a colored pill', async () => {
        mockedFetch.mockResolvedValue([
            notification('1', 'mention', account('a', 'alice')),
            notification('2', 'favourite', account('b', 'bob')),
        ]);
        await renderScreen();

        await screen.findByText(/mentioned you/);
        expect(screen.getAllByTestId('avatar-badge')).toHaveLength(2);
        expect(screen.queryByText('MENTION')).toBeNull();
        expect(screen.queryByText('FAVOURITE')).toBeNull();
    });

    it('opens the post when a row is pressed', async () => {
        const onStatusPress = jest.fn();
        mockedFetch.mockResolvedValue([notification('1', 'favourite', account('a', 'alice'))]);
        await render(
            <QueryClientProvider client={queryClient}>
                <Notifications onStatusPress={onStatusPress} />
            </QueryClientProvider>
        );

        await fireEvent.press(await screen.findByRole('button', { name: /alice favourited your post/ }));

        expect(onStatusPress).toHaveBeenCalledWith('s-1');
    });

    it('replies to a mention from the row', async () => {
        const mention = notification('1', 'mention', account('a', 'alice'));
        mockedFetch.mockResolvedValue([mention]);
        await renderScreen();

        await fireEvent.press(await screen.findByRole('button', { name: 'Reply' }));

        expect(mockOpenCompose).toHaveBeenCalledWith({ replyToStatus: mention.status });
    });

    it('favourites a mention from the row', async () => {
        mockedFetch.mockResolvedValue([notification('1', 'mention', account('a', 'alice'))]);
        mockedFavourite.mockResolvedValue({ id: 's-1', content: '<p>post 1</p>', spoiler_text: '', emojis: [], favourited: true } as any);
        await renderScreen();

        const favourite = await screen.findByRole('button', { name: 'Favourite' });
        expect(favourite).not.toBeSelected();
        await fireEvent.press(favourite);

        expect(mockedFavourite).toHaveBeenCalledWith('s-1');
        expect(screen.getByRole('button', { name: 'Favourite' })).toBeSelected();
    });

    it('shows the content warning instead of the text behind it', async () => {
        const warned = notification('1', 'mention', account('a', 'alice'));
        warned.status = { ...warned.status!, spoiler_text: 'spoilers', content: '<p>the ending</p>' };
        mockedFetch.mockResolvedValue([warned]);
        await renderScreen();

        expect(await screen.findByText('CW: spoilers')).toBeTruthy();
        expect(screen.queryByText(/the ending/)).toBeNull();
    });

    it("moves the server's read marker when it shows them, so the web stops counting them too", async () => {
        mockedFetch.mockResolvedValue([
            notification('110', 'mention', account('a', 'alice')),
            notification('99', 'favourite', account('b', 'bob')),
        ]);
        await renderScreen();

        await screen.findByText(/mentioned you/);
        await waitFor(() => expect(mockedMarkRead).toHaveBeenCalledWith('110'));
        // Still new on screen while you look
        expect(screen.getAllByTestId('unread-row-dot')).toHaveLength(2);
    });

    it("stays quiet when the marker can't be saved", async () => {
        mockedFetch.mockResolvedValue([notification('2', 'favourite', account('a', 'alice'))]);
        mockedMarkRead.mockRejectedValueOnce(new Error('offline'));
        const toast = jest.spyOn(dialog, 'toast');
        await renderScreen();

        await screen.findByText(/favourited your post/);
        await waitFor(() => expect(mockedMarkRead).toHaveBeenCalled());
        expect(toast).not.toHaveBeenCalled();
    });

    it('marks everything up to the newest notification as read', async () => {
        mockedFetch.mockResolvedValue([
            notification('110', 'mention', account('a', 'alice')),
            notification('99', 'favourite', account('b', 'bob')),
        ]);
        mockedMarkRead.mockResolvedValue();
        await renderScreen();
        await screen.findByText(/mentioned you/);

        await fireEvent.press(screen.getByRole('button', { name: 'Mark all as read' }));

        expect(mockedMarkRead).toHaveBeenCalledWith('110');
        expect(screen.getByRole('button', { name: 'Mark all as read' })).toBeSelected();
    });

    describe('clear all', () => {
        // Presses the confirmation's destructive button, as the user would
        const confirmClear = async () => {
            const alert = jest.spyOn(dialog, 'alert');
            await fireEvent.press(screen.getByRole('button', { name: 'Clear' }));
            await fireEvent.press(await screen.findByRole('button', { name: /Clear all/ }));
            const [title, , buttons] = alert.mock.calls[alert.mock.calls.length - 1];
            expect(title).toBe('Clear all notifications?');
            await waitFor(async () => buttons!.find(button => button.style === 'destructive')!.onPress!());
        };

        it('asks first, then deletes them and empties the list', async () => {
            mockedFetch.mockResolvedValue([notification('110', 'mention', account('a', 'alice'))]);
            (clearNotifications as jest.Mock).mockResolvedValue(undefined);
            const toast = jest.spyOn(dialog, 'toast');
            await renderScreen();
            await screen.findByText(/mentioned you/);

            await confirmClear();

            expect(clearNotifications).toHaveBeenCalledTimes(1);
            await waitFor(() => expect(screen.queryByText(/mentioned you/)).toBeNull());
            expect(toast).toHaveBeenCalledWith('Notifications cleared');
        });

        it('keeps the list and says so when clearing fails', async () => {
            mockedFetch.mockResolvedValue([notification('110', 'mention', account('a', 'alice'))]);
            (clearNotifications as jest.Mock).mockRejectedValue(new Error('offline'));
            const toast = jest.spyOn(dialog, 'toast');
            await renderScreen();
            await screen.findByText(/mentioned you/);

            await confirmClear();

            await waitFor(() => expect(toast).toHaveBeenCalledWith("Couldn't clear notifications. Try again."));
            expect(screen.getByText(/mentioned you/)).toBeTruthy();
        });

        it('removes only the notifications you tick', async () => {
            mockedFetch.mockResolvedValue([
                notification('110', 'mention', account('a', 'alice')),
                notification('99', 'mention', account('b', 'bob')),
            ]);
            (dismissNotificationGroup as jest.Mock).mockResolvedValue(undefined);
            const alert = jest.spyOn(dialog, 'alert');
            await renderScreen();
            await screen.findAllByText(/mentioned you/);

            await fireEvent.press(screen.getByRole('button', { name: 'Clear' }));
            await fireEvent.press(await screen.findByRole('button', { name: 'Select notifications' }));
            const remove = screen.getByRole('button', { name: 'Remove' });
            expect(remove).toBeDisabled();

            // While picking, a row ticks instead of opening
            await fireEvent.press(screen.getByRole('checkbox', { name: /bob/ }));
            expect(screen.getByText('1 selected')).toBeTruthy();
            await fireEvent.press(remove);
            const [title, , buttons] = alert.mock.calls[alert.mock.calls.length - 1];
            expect(title).toBe('Remove 1 notification?');
            await waitFor(async () => buttons!.find(button => button.style === 'destructive')!.onPress!());

            expect(dismissNotificationGroup).toHaveBeenCalledTimes(1);
            expect((dismissNotificationGroup as jest.Mock).mock.calls[0][0]).toMatchObject({ ids: ['99'] });
            await waitFor(() => expect(screen.getAllByText(/mentioned you/)).toHaveLength(1));
            // Done: back to the normal header
            expect(screen.getByRole('button', { name: 'Clear' })).toBeTruthy();
        });

        it('starts picking with the notification you hold ticked', async () => {
            mockedFetch.mockResolvedValue([
                notification('110', 'mention', account('a', 'alice')),
                notification('99', 'mention', account('b', 'bob')),
            ]);
            await renderScreen();
            const [, bobs] = await screen.findAllByText(/mentioned you/);

            await fireEvent(bobs, 'longPress');

            expect(screen.getByText('1 selected')).toBeTruthy();
            expect(screen.getByRole('checkbox', { name: /bob/ })).toBeChecked();
            expect(screen.getByRole('checkbox', { name: /alice/ })).not.toBeChecked();
            expect(screen.getByRole('button', { name: 'Remove' })).toBeEnabled();
        });

        it('is off while there is nothing to clear', async () => {
            mockedFetch.mockResolvedValue([]);
            await renderScreen();
            await waitFor(() => expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled());
        });
    });

    describe('swiping a row away', () => {
        const width = Dimensions.get('window').width;
        const swipe = async (translationX: number, velocityX = 0, last: State = State.END) => {
            mockedFetch.mockResolvedValue([notification('1', 'mention', account('a', 'alice'))]);
            (dismissNotificationGroup as jest.Mock).mockResolvedValue(undefined);
            await renderScreen();
            await screen.findByText(/mentioned you/);
            await act(async () => {
                fireGestureHandler(getByGestureTestId('swipe-to-remove'), [
                    { state: State.BEGAN, translationX: 0, velocityX: 0 },
                    { state: State.ACTIVE, translationX, velocityX },
                    { state: last, translationX, velocityX },
                ]);
            });
        };

        it('removes a row dragged nearly all the way across', async () => {
            await swipe(width * 0.8);

            await waitFor(() => expect(dismissNotificationGroup).toHaveBeenCalledTimes(1));
        });

        it.each([
            ['a quick flick', width * 0.1, 8000],
            ['a very fast short drag', width * 0.4, 20000],
            ['a slow drag most of the way', width * 0.65, 0],
            ['a drag stopped just short', width * 0.74, 3000],
        ])("doesn't remove a row on %s", async (_, translationX, velocityX) => {
            await swipe(translationX, velocityX);

            expect(dismissNotificationGroup).not.toHaveBeenCalled();
            expect(screen.getByText(/mentioned you/)).toBeTruthy();
        });

        it("doesn't remove a row when the gesture is cancelled", async () => {
            await swipe(width * 0.9, 0, State.CANCELLED);

            expect(dismissNotificationGroup).not.toHaveBeenCalled();
        });
    });

    describe('grouped rows', () => {
        const favouriteOf = (id: string, from: Account) => ({
            ...notification(id, 'favourite', from),
            status: { id: 'mine', content: '<p>which coat?</p>', spoiler_text: '', emojis: [] } as any,
        });

        it('folds favourites of the same post into one row', async () => {
            const onStatusPress = jest.fn();
            mockedFetch.mockResolvedValue([
                favouriteOf('3', account('a', 'alice')),
                favouriteOf('2', account('b', 'bob')),
                favouriteOf('1', account('c', 'carol')),
            ]);
            await render(
                <QueryClientProvider client={queryClient}>
                    <Notifications onStatusPress={onStatusPress} />
                </QueryClientProvider>
            );

            const row = await screen.findByRole('button', { name: /^alice, bob and 1 other favourited your post/ });
            expect(screen.getAllByText(/favourited your post/)).toHaveLength(1);
            expect(screen.getByTestId('avatar-stack')).toBeTruthy();

            await fireEvent.press(row);
            expect(onStatusPress).toHaveBeenCalledWith('mine');
        });

        it('names both people when there are two', async () => {
            mockedFetch.mockResolvedValue([favouriteOf('2', account('a', 'alice')), favouriteOf('1', account('b', 'bob'))]);
            await renderScreen();

            expect(await screen.findByLabelText(/^alice and bob favourited your post/)).toBeTruthy();
        });

        it('keeps follows as separate rows with their own Follow back', async () => {
            mockedFetch.mockResolvedValue([
                notification('2', 'follow', account('a', 'alice')),
                notification('1', 'follow', account('b', 'bob')),
            ]);
            mockedRelationships.mockResolvedValue([relationship('a', false), relationship('b', false)]);
            await renderScreen();

            expect(await screen.findAllByText('Follow back')).toHaveLength(2);
            expect(screen.queryByTestId('avatar-stack')).toBeNull();
        });
    });
});

describe('notification rows', () => {
    const now = new Date(2026, 8, 29, 15, 0);
    const at = (date: Date) => groupsFromNotifications([notification(String(date.getTime()), 'favourite', account('a', 'alice'), date)])[0];

    it('splits into Today and Earlier and marks each group\'s first and last row', () => {
        const items = buildListItems([at(new Date(2026, 8, 29, 14)), at(new Date(2026, 8, 29, 9)), at(new Date(2026, 8, 28, 23))], now);

        expect(items.map(item => (item.kind === 'section' ? item.label : `${item.first ? 'F' : ''}${item.last ? 'L' : ''}`))).toEqual([
            'Today', 'F', 'L', 'Earlier', 'FL',
        ]);
    });

    it('puts groups newer than the read point first, under New, comparing ids by length first', () => {
        const groups = groupsFromNotifications([
            notification('100', 'favourite', account('a', 'alice'), new Date(2026, 8, 29, 14)),
            notification('99', 'reblog', account('b', 'bob'), new Date(2026, 8, 29, 13)),
        ]);
        const labels = (readPoint?: string | null) =>
            buildListItems(groups, now, undefined, readPoint).map(item => (item.kind === 'section' ? item.label : item.unread ? 'unread' : 'read'));

        expect(labels('99')).toEqual(['New', 'unread', 'Today', 'read']);
        expect(labels(null)).toEqual(['New', 'unread', 'unread']);
        // Still loading: no New yet
        expect(labels(undefined)).toEqual(['Today', 'read', 'read']);
    });

    it('leaves out empty sections', () => {
        const items = buildListItems([at(new Date(2026, 8, 20))], now);
        expect(items.filter(item => item.kind === 'section').map(item => item.kind === 'section' && item.label)).toEqual(['Earlier']);
    });

    it.each([
        [new Date(2026, 8, 29, 14, 59, 30), 'now'],
        [new Date(2026, 8, 29, 14, 56), '4m'],
        [new Date(2026, 8, 29, 12, 0), '3h'],
        [new Date(2026, 8, 28, 10, 0), 'Mon'],
        [new Date(2026, 8, 3, 10, 0), 'Sep 3'],
    ])('formats %s as %s', (date, expected) => {
        expect(notificationTime(date.toISOString(), now)).toBe(expected);
    });

    it('turns post HTML into plain text with its line breaks', () => {
        expect(plainText('<p>Tom &amp; Jerry&#39;s</p><p>line<br>break</p>')).toBe("Tom & Jerry's\n\nline\nbreak");
    });

    it.each([
        [['Ana'], 1, 'Ana'],
        [['Ana', 'Joon'], 2, 'Ana and Joon'],
        [['Ana', 'Joon', 'Rui'], 3, 'Ana, Joon and 1 other'],
        [['Ana', 'Joon', 'Rui'], 6, 'Ana, Joon and 4 others'],
    ])('names %j (%i in all) as "%s"', (names, count, expected) => {
        expect(actorsText(names, count)).toBe(expected);
    });

    it('drops your own handle from the start of a mention and keeps who else it is for', () => {
        expect(withoutOwnMention('@me @bob@floss.social apricot, obviously', 'me')).toBe('@bob@floss.social apricot, obviously');
        expect(withoutOwnMention('@bob @ME @ana bom dia', 'me')).toBe('@bob @ana bom dia');
        expect(withoutOwnMention('@me apricot', 'me')).toBe('apricot');
        expect(withoutOwnMention('apricot @me', 'me')).toBe('apricot @me');
        expect(withoutOwnMention('@me ', 'me')).toBe('@me ');
        expect(withoutOwnMention('@me hi', undefined)).toBe('@me hi');
    });
});
