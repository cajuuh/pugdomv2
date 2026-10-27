import React from 'react';
import { View } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils/queryClient';
import Notifications from '../screens/Notifications/notifications';
import { clearNotifications, dismissNotificationGroup, groupsFromNotifications } from '../services/mastodon/notifications';
import { dialog } from '../services/dialog';
import { authorizeFollowRequest, followAccount, getRelationships } from '../services/mastodon/accounts';
import { favouriteStatus } from '../services/mastodon/statuses';
import { markNotificationsRead } from '../services/mastodon/markers';
import { Account, Notification } from '../services/mastodon/types';
import { actorsText, buildListItems, notificationTime, plainText, withoutLeadingMentions } from '../screens/Notifications/rows';

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
jest.mock('../services/settingsContext', () => ({ useSettings: () => ({ groupNotifications: true }) }));
jest.mock('../services/mastodon/accounts', () => ({
    followAccount: jest.fn(),
    getRelationships: jest.fn(),
    authorizeFollowRequest: jest.fn(),
    rejectFollowRequest: jest.fn(),
}));
jest.mock('../services/authContext', () => ({ useOptionalAuth: () => ({ user: { id: 'me' } }) }));
jest.mock('../services/mastodon/statuses', () => ({ favouriteStatus: jest.fn(), unfavouriteStatus: jest.fn() }));
jest.mock('../services/mastodon/markers', () => ({ markNotificationsRead: jest.fn() }));
jest.mock('../services/themeContext', () => ({
    useTheme: () => jest.requireActual('../testUtils/theme').mockTheme,
}));
const mockOpenMedia = jest.fn();
jest.mock('../components/MediaViewer/mediaViewer', () => ({ useMediaViewer: () => ({ openMedia: mockOpenMedia }) }));
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

    it('shows the pictures in a reply, which open the viewer', async () => {
        const reply = notification('1', 'mention', account('a', 'alice'));
        const picture = { id: 'm1', type: 'image', url: 'u', preview_url: 'p', description: 'A pug on a sofa' };
        mockedFetch.mockResolvedValue([{ ...reply, status: { ...reply.status, content: '<p>@me</p>', media_attachments: [picture] } }]);
        await renderScreen();

        await fireEvent.press(await screen.findByRole('imagebutton', { name: 'A pug on a sofa' }));
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
        expect(await screen.findByText('Following')).toBeTruthy();
        expect(screen.queryByText('Follow back')).toBeNull();
    });

    it('does not offer to follow accounts already followed', async () => {
        mockedFetch.mockResolvedValue([notification('1', 'follow', account('b', 'bob'))]);
        mockedRelationships.mockResolvedValue([relationship('b', true)]);
        await renderScreen();

        expect(await screen.findByText('Following')).toBeTruthy();
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
        await renderScreen();

        await screen.findByText(/favourited your post/);
        expect(screen.getAllByRole('header').map(header => header.props.children)).toEqual(['Notifications', 'Today', 'Earlier']);
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

    it('drops the handles a reply starts with, unless that is the whole post', () => {
        expect(withoutLeadingMentions('@me @bob@floss.social apricot, obviously')).toBe('apricot, obviously');
        expect(withoutLeadingMentions('@me ')).toBe('@me ');
    });
});
