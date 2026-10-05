import React from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils/queryClient';
import apiClient from '../services/api/client';
import { addToList, getListAccounts, removeFromList, updateList } from '../services/mastodon/lists';
import { fetchFeedPage } from '../services/mastodon/feedService';
import { createListFeed, feedIcon, feedLabel } from '../services/mastodon/feedTypes';
import { getPinnedFeeds, pinFeed, updatePinnedFeed } from '../services/pinnedFeeds';
import { createTranslator } from '../services/i18n/translate';
import ListEditor from '../screens/ListEditor/listEditor';
import { FeedsSheet } from '../components/FeedsSheet/feedsSheet';
import { AccountListsSheet } from '../components/AccountListsSheet/accountListsSheet';
import { NavigationProvider } from '../services/navigationContext';
import { Account } from '../services/mastodon/types';

jest.mock('../services/api/client', () => ({
    __esModule: true,
    default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));
jest.mock('../services/authContext', () => ({ useAuth: () => ({ user: { id: 'me' } }), useOptionalAuth: () => ({ user: { id: 'me' } }) }));
jest.mock('../services/themeContext', () => ({
    useTheme: () => jest.requireActual('../testUtils/theme').mockTheme,
}));

const api = apiClient as unknown as Record<'get' | 'post' | 'put' | 'delete', jest.Mock>;
const friends = { id: '7', title: 'Friends', replies_policy: 'list' as const, exclusive: false };
const ana: Account = { id: 'ana', username: 'ana', acct: 'ana', display_name: 'Ana', avatar: '', emojis: [] };

// GET answers: your lists, a list's members, the lists Ana is in, followed tags
const serve = ({ memberOf = [] as object[] } = {}) =>
    api.get.mockImplementation(async (url: string) => {
        if (url === '/lists') return { data: [friends] };
        if (url === '/lists/7/accounts') return { data: [ana] };
        if (url === '/accounts/ana/lists') return { data: memberOf };
        if (url === '/followed_tags') return { data: [] };
        return { data: [] };
    });

const withQuery = (children: React.ReactNode) => (
    <QueryClientProvider client={createTestQueryClient()}>
        <NavigationProvider>{children}</NavigationProvider>
    </QueryClientProvider>
);

beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    serve();
    api.post.mockResolvedValue({ data: friends });
    api.put.mockImplementation(async (_url: string, body: object) => ({ data: { ...friends, ...body } }));
    api.delete.mockResolvedValue({ data: {} });
});
afterEach(() => jest.restoreAllMocks());

describe('lists service', () => {
    it('talks to the lists endpoints', async () => {
        await getListAccounts('7');
        await updateList('7', { title: 'Pals', exclusive: true });
        await addToList('7', ['ana']);
        await removeFromList('7', ['ana']);

        expect(api.get).toHaveBeenCalledWith('/lists/7/accounts', { params: { limit: 0 } });
        expect(api.put).toHaveBeenCalledWith('/lists/7', { title: 'Pals', exclusive: true });
        expect(api.post).toHaveBeenCalledWith('/lists/7/accounts', { account_ids: ['ana'] });
        expect(api.delete).toHaveBeenCalledWith('/lists/7/accounts', { params: { account_ids: ['ana'] } });
    });

    it('fetches a list as a feed', async () => {
        const feed = createListFeed(friends);
        await fetchFeedPage(feed, '99');

        expect(feed).toMatchObject({ id: 'list:7', kind: 'list', title: 'Friends', listId: '7' });
        expect(feedLabel(feed, createTranslator('en'))).toBe('Friends');
        expect(feedIcon('list')).toBe('list-outline');
        expect(api.get).toHaveBeenCalledWith('/timelines/list/7', { params: { max_id: '99', since_id: undefined, limit: undefined } });
    });

    it('updates a pinned feed in place, and leaves unpinned ones alone', async () => {
        await pinFeed('me', createListFeed(friends));
        await updatePinnedFeed('me', createListFeed({ id: '7', title: 'Pals' }));
        await updatePinnedFeed('me', createListFeed({ id: '8', title: 'Other' }));

        const pinned = await getPinnedFeeds('me');
        expect(pinned.find(feed => feed.id === 'list:7')?.title).toBe('Pals');
        expect(pinned.some(feed => feed.id === 'list:8')).toBe(false);
    });
});

describe('List editor', () => {
    it('creates a list', async () => {
        const onBack = jest.fn();
        await render(withQuery(<ListEditor onBack={onBack} />));

        expect(screen.getByRole('button', { name: 'Create list' })).toBeDisabled();
        await fireEvent.changeText(screen.getByLabelText('Name'), 'Close friends');
        await fireEvent.press(screen.getByRole('button', { name: 'Create list' }));

        await waitFor(() => expect(onBack).toHaveBeenCalled());
        expect(api.post).toHaveBeenCalledWith('/lists', { title: 'Close friends', replies_policy: 'list', exclusive: false });
        // A new list has no members to show yet
        expect(screen.queryByText('Members')).toBeNull();
    });

    it('edits a list and renames its pinned pill', async () => {
        await pinFeed('me', createListFeed(friends));
        const onBack = jest.fn();
        await render(withQuery(<ListEditor listId="7" onBack={onBack} />));

        await waitFor(() => expect(screen.getByLabelText('Name').props.value).toBe('Friends'));
        await fireEvent.changeText(screen.getByLabelText('Name'), 'Pals');
        await fireEvent(screen.getByLabelText('Hide from Home'), 'valueChange', true);
        await fireEvent.press(screen.getByRole('button', { name: 'Replies shown, To list members' }));
        await fireEvent.press(screen.getByRole('radio', { name: 'None' }));
        await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(onBack).toHaveBeenCalled());
        expect(api.put).toHaveBeenCalledWith('/lists/7', { title: 'Pals', replies_policy: 'none', exclusive: true });
        expect((await getPinnedFeeds('me')).find(feed => feed.id === 'list:7')?.title).toBe('Pals');
    });

    it('shows members and removes one', async () => {
        await render(withQuery(<ListEditor listId="7" onBack={jest.fn()} />));

        await fireEvent.press(await screen.findByRole('button', { name: 'Remove Ana from the list' }));

        expect(api.delete).toHaveBeenCalledWith('/lists/7/accounts', { params: { account_ids: ['ana'] } });
    });

    it('asks before deleting, then unpins the list', async () => {
        await pinFeed('me', createListFeed(friends));
        const onBack = jest.fn();
        await render(withQuery(<ListEditor listId="7" onBack={onBack} />));
        await screen.findByRole('button', { name: 'Remove Ana from the list' });

        await fireEvent.press(screen.getByRole('button', { name: 'Delete list' }));
        const [title, , buttons] = (Alert.alert as jest.Mock).mock.calls[0];
        expect(title).toBe('Delete "Friends"?');
        expect(api.delete).not.toHaveBeenCalledWith('/lists/7');
        await act(async () => {
            buttons.find((b: any) => b.style === 'destructive').onPress();
        });

        await waitFor(() => expect(onBack).toHaveBeenCalled());
        expect(api.delete).toHaveBeenCalledWith('/lists/7');
        expect((await getPinnedFeeds('me')).some(feed => feed.id === 'list:7')).toBe(false);
    });
});

describe('Lists in the Feeds sheet', () => {
    it('lists your lists to open, pin and edit, and starts a new one', async () => {
        const onEditList = jest.fn();
        const onSelectFeed = jest.fn();
        await render(withQuery(<FeedsSheet visible onClose={jest.fn()} onSelectFeed={onSelectFeed} onCreateFeed={jest.fn()} onEditList={onEditList} onAddServer={jest.fn()} />));

        await fireEvent.press(await screen.findByRole('button', { name: 'Edit Friends' }));
        await fireEvent.press(screen.getByRole('button', { name: 'New list' }));
        await fireEvent.press(screen.getByRole('button', { name: 'Open Friends' }));

        expect(onEditList).toHaveBeenNthCalledWith(1, '7');
        expect(onEditList).toHaveBeenNthCalledWith(2, undefined);
        expect(onSelectFeed).toHaveBeenCalledWith(createListFeed(friends));
    });
});

describe('Adding someone to lists', () => {
    const renderSheet = (following: boolean) =>
        render(withQuery(<AccountListsSheet visible onClose={jest.fn()} account={ana} following={following} />));

    it('explains that lists only hold people you follow', async () => {
        await renderSheet(false);
        expect(screen.getByText('Follow Ana to add them to a list.')).toBeTruthy();
    });

    it('adds and removes them', async () => {
        await renderSheet(true);

        await fireEvent.press(await screen.findByRole('checkbox', { name: 'Friends' }));
        expect(api.post).toHaveBeenCalledWith('/lists/7/accounts', { account_ids: ['ana'] });
    });

    it('shows the lists they are already in', async () => {
        serve({ memberOf: [friends] });
        await renderSheet(true);

        await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Friends' })).toBeChecked());
        await fireEvent.press(screen.getByRole('checkbox', { name: 'Friends' }));
        expect(api.delete).toHaveBeenCalledWith('/lists/7/accounts', { params: { account_ids: ['ana'] } });
    });
});
