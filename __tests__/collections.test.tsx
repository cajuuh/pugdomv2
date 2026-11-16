import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils/queryClient';
import apiClient from '../services/api/client';
import { addToCollection, canFeature, createCollection, deleteCollection, featuredAccounts, getAccountCollections, getCollection, leaveCollection, removeFromCollection, updateCollection } from '../services/mastodon/collections';
import { AccountCollectionsSheet } from '../components/AccountCollectionsSheet/accountCollectionsSheet';
import CollectionEditor from '../screens/CollectionEditor/collectionEditor';
import { dialog } from '../services/dialog';
import { useAccountCollections } from '../hooks/useCollections';
import { CollectionCards } from '../components/CollectionCards/collectionCards';
import Collection from '../screens/Collection/collection';
import { NavigationProvider, useNavigator } from '../services/navigationContext';
import { Account, Collection as CollectionType, CollectionItem } from '../services/mastodon/types';

jest.mock('../services/api/client', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() }, publicClient: { get: jest.fn() } }));
jest.mock('../services/storage', () => ({ getCredentials: jest.fn().mockResolvedValue({ accessToken: 't', instanceUrl: 'https://pug.social' }) }));
const mockMe = { current: { id: 'me', username: 'me', acct: 'me', display_name: 'Me', avatar: '', emojis: [] } as Account };
jest.mock('../services/authContext', () => ({ useAuth: () => ({ user: mockMe.current }), useOptionalAuth: () => ({ user: mockMe.current }) }));
jest.mock('../services/themeContext', () => ({ useTheme: () => jest.requireActual('../testUtils/theme').mockTheme }));
jest.mock('../services/settingsContext', () => ({ useOptionalSettings: () => null, useSettings: () => ({ hideCounts: false }) }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(() => Promise.resolve()) }));

const api = apiClient as unknown as Record<'get' | 'post' | 'patch' | 'delete', jest.Mock>;
const person = (id: string, name: string): Account => ({ id, username: id, acct: `${id}@pug.social`, display_name: name, avatar: '', emojis: [] });
const curator = person('cur', 'Curator');
const ana = person('ana', 'Ana');
const bo = person('bo', 'Bo');
const cy = person('cy', 'Cy');
const item = (id: string, account_id: string, state: CollectionItem['state']): CollectionItem => ({ id, account_id, state, created_at: '' });
const collection = (extra: Partial<CollectionType> = {}): CollectionType => ({
    id: 'c1',
    account_id: 'cur',
    uri: 'https://pug.social/collections/c1',
    url: 'https://pug.social/@cur/collections/c1',
    name: 'Pug artists',
    description: '<p>People who draw pugs</p>',
    language: 'en',
    local: true,
    sensitive: false,
    discoverable: true,
    tag: { name: 'pugart', url: '' },
    created_at: '',
    updated_at: '',
    item_count: 2,
    items: [item('i2', 'bo', 'accepted'), item('i1', 'ana', 'accepted'), item('i3', 'cy', 'pending'), item('i4', 'gone', 'rejected')],
    ...extra,
});

const StackProbe = () => <Text testID="stack">{JSON.stringify(useNavigator().stack.map(entry => entry.route.name))}</Text>;
const wrap = (children: React.ReactNode) => (
    <QueryClientProvider client={createTestQueryClient()}>
        <NavigationProvider>
            {children}
            <StackProbe />
        </NavigationProvider>
    </QueryClientProvider>
);

beforeEach(() => {
    jest.clearAllMocks();
    mockMe.current = { ...mockMe.current, id: 'me' };
});

describe('collections API', () => {
    it('reads someone’s collections and one collection with its people', async () => {
        api.get.mockResolvedValueOnce({ data: { collections: [collection()] } });
        await expect(getAccountCollections('cur')).resolves.toEqual([collection()]);
        expect(api.get).toHaveBeenCalledWith('/accounts/cur/collections', { params: { limit: 80 } });

        api.get.mockResolvedValueOnce({ data: { collection: collection(), accounts: [curator, ana] } });
        await expect(getCollection('c1')).resolves.toEqual({ collection: collection(), accounts: [curator, ana] });
        expect(api.get).toHaveBeenLastCalledWith('/collections/c1');
    });

    it('lists the people in the collection’s order, pending ones only for the owner', () => {
        const accounts = [curator, ana, bo, cy];
        expect(featuredAccounts(collection(), accounts, 'me').map(entry => entry.account.id)).toEqual(['bo', 'ana']);
        expect(featuredAccounts(collection(), accounts, 'cur').map(entry => entry.account.id)).toEqual(['bo', 'ana', 'cy']);
    });
});

describe('useAccountCollections', () => {
    const run = async (apiVersion: number) => {
        api.get.mockImplementation(async (url: string) => {
            if (url.endsWith('/api/v2/instance')) return { data: { api_versions: { mastodon: apiVersion }, configuration: { statuses: { max_characters: 500 } } } };
            if (url === '/accounts/cur/collections') return { data: { collections: [collection()] } };
            throw new Error(`unexpected ${url}`);
        });
        return renderHook(() => useAccountCollections('cur'), { wrapper: ({ children }) => wrap(children) });
    };

    it('asks only servers that have collections (API version 10)', async () => {
        const { result } = await run(10);
        await waitFor(() => expect(result.current).toHaveLength(1));
    });

    it('stays empty on older servers, without asking', async () => {
        const { result } = await run(9);
        await waitFor(() => expect(api.get).toHaveBeenCalledWith('https://pug.social/api/v2/instance'));
        expect(result.current).toEqual([]);
        expect(api.get).not.toHaveBeenCalledWith('/accounts/cur/collections', expect.anything());
    });
});

describe('CollectionCards', () => {
    it('shows each collection with its count and topic, and opens it', async () => {
        const onOpen = jest.fn();
        await render(<CollectionCards collections={[collection(), collection({ id: 'c2', name: 'Secret pugs', discoverable: false, tag: null, item_count: 1 })]} onOpen={onOpen} gutter={20} />);
        expect(screen.getByText('Collections')).toBeTruthy();
        expect(screen.getByText('Pug artists')).toBeTruthy();
        expect(screen.getByText('2 accounts')).toBeTruthy();
        expect(screen.getByText('#pugart')).toBeTruthy();
        // Yours can be unlisted
        expect(screen.getByText('1 account')).toBeTruthy();
        expect(screen.getByText('Only by link')).toBeTruthy();

        await fireEvent.press(screen.getByRole('button', { name: 'Pug artists, 2 accounts' }));
        expect(onOpen).toHaveBeenCalledWith(collection());
    });

    it('draws nothing without collections', async () => {
        await render(<CollectionCards collections={[]} onOpen={jest.fn()} gutter={20} />);
        expect(screen.queryByText('Collections')).toBeNull();
    });
});

describe('Collection screen', () => {
    const open = async () => {
        api.get.mockImplementation(async (url: string) => {
            if (url === '/collections/c1') return { data: { collection: collection(), accounts: [curator, ana, bo, cy] } };
            if (url === '/accounts/relationships') return { data: [] };
            throw new Error(`unexpected ${url}`);
        });
        await render(wrap(<Collection collectionId="c1" onBack={jest.fn()} />));
        await screen.findByText('Ana');
    };

    it('shows the curator, the description and the people who agreed to be featured', async () => {
        await open();
        expect(screen.getByText('Pug artists')).toBeTruthy();
        expect(screen.getByText('By Curator')).toBeTruthy();
        expect(screen.getByText('People who draw pugs')).toBeTruthy();
        expect(screen.getByText('Bo')).toBeTruthy();
        // Not agreed yet: only its owner sees it
        expect(screen.queryByText('Cy')).toBeNull();
        expect(screen.getByRole('button', { name: 'Share collection' })).toBeTruthy();
    });

    it('shows the owner the people who haven’t agreed yet', async () => {
        mockMe.current = { ...mockMe.current, id: 'cur' };
        await open();
        await screen.findByText('Cy');
        expect(screen.getByText("Hasn't agreed to be featured yet")).toBeTruthy();
    });

    it('opens the topic as a hashtag timeline', async () => {
        await open();
        await fireEvent.press(screen.getByText('#pugart'));
        expect(screen.getByTestId('stack').props.children).toContain('hashtag');
    });
});

describe('changing collections', () => {
    it('sends Mastodon 4.6’s write calls', async () => {
        api.post.mockResolvedValue({ data: { collection: collection(), collection_item: item('i9', 'ana', 'accepted') } });
        api.patch.mockResolvedValue({ data: { collection: collection() } });
        api.delete.mockResolvedValue({ data: {} });

        await createCollection({ name: 'Pug artists', discoverable: true }, ['ana']);
        expect(api.post).toHaveBeenCalledWith('/collections', { name: 'Pug artists', discoverable: true, account_ids: ['ana'] });
        await updateCollection('c1', { name: 'Pug painters' });
        expect(api.patch).toHaveBeenCalledWith('/collections/c1', { name: 'Pug painters' });
        await deleteCollection('c1');
        expect(api.delete).toHaveBeenCalledWith('/collections/c1');
        await addToCollection('c1', 'ana');
        expect(api.post).toHaveBeenCalledWith('/collections/c1/items', { account_id: 'ana' });
        // Items go by their own id, not the account's
        await removeFromCollection('c1', 'i1');
        expect(api.delete).toHaveBeenCalledWith('/collections/c1/items/i1');
        await leaveCollection('c1', 'i1');
        expect(api.post).toHaveBeenCalledWith('/collections/c1/items/i1/revoke');
    });

    it('can feature only people whose approval is automatic or manual', () => {
        const approval = (current_user: 'automatic' | 'manual' | 'denied' | 'unknown' | 'missing') => ({ feature_approval: { automatic: [], manual: [], current_user } });
        expect(canFeature(approval('automatic'))).toBe(true);
        expect(canFeature(approval('manual'))).toBe(true);
        expect(canFeature(approval('denied'))).toBe(false);
        expect(canFeature(approval('unknown'))).toBe(false);
        expect(canFeature(approval('missing'))).toBe(false);
        expect(canFeature({})).toBe(false);
    });
});

describe('your collection', () => {
    const openMine = async () => {
        mockMe.current = { ...mockMe.current, id: 'cur' };
        api.get.mockImplementation(async (url: string) => {
            if (url === '/collections/c1') return { data: { collection: collection(), accounts: [curator, ana, bo, cy] } };
            if (url === '/accounts/relationships') return { data: [] };
            throw new Error(`unexpected ${url}`);
        });
        api.delete.mockResolvedValue({ data: {} });
        await render(wrap(<Collection collectionId="c1" onBack={jest.fn()} />));
        await screen.findByText('Ana');
    };

    it('takes people out instead of offering to follow them', async () => {
        await openMine();
        await fireEvent.press(screen.getByRole('button', { name: 'Remove Ana from the collection' }));
        expect(api.delete).toHaveBeenCalledWith('/collections/c1/items/i1');
    });

    it('opens the editor', async () => {
        await openMine();
        await fireEvent.press(screen.getByRole('button', { name: 'Edit collection' }));
        expect(screen.getByTestId('stack').props.children).toContain('collectionEditor');
    });
});

describe('someone else’s collection you are in', () => {
    it('lets you leave it, after asking', async () => {
        mockMe.current = { ...mockMe.current, id: 'ana' };
        const alert = jest.spyOn(dialog, 'alert').mockImplementation(() => {});
        api.get.mockImplementation(async (url: string) => {
            if (url === '/collections/c1') return { data: { collection: collection(), accounts: [curator, ana, bo] } };
            if (url === '/accounts/relationships') return { data: [] };
            throw new Error(`unexpected ${url}`);
        });
        api.post.mockResolvedValue({ data: {} });
        await render(wrap(<Collection collectionId="c1" onBack={jest.fn()} />));
        await screen.findByText('Bo');
        expect(screen.queryByRole('button', { name: 'Edit collection' })).toBeNull();

        await fireEvent.press(screen.getByRole('button', { name: 'Leave collection' }));
        const buttons = alert.mock.calls[0][2]!;
        await buttons.find(button => button.style === 'destructive')!.onPress!();
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('/collections/c1/items/i1/revoke'));
    });
});

describe('adding someone to your collections', () => {
    const serve = (mine: CollectionType[]) =>
        api.get.mockImplementation(async (url: string) => {
            if (url.endsWith('/api/v2/instance')) return { data: { api_versions: { mastodon: 10 }, configuration: { statuses: { max_characters: 500 } } } };
            if (url === '/accounts/me/collections') return { data: { collections: mine } };
            throw new Error(`unexpected ${url}`);
        });
    const dee = { ...person('dee', 'Dee'), feature_approval: { automatic: ['public'], manual: [], current_user: 'automatic' as const } };
    const sheet = (account: Account) => render(wrap(<AccountCollectionsSheet visible onClose={jest.fn()} account={account} />));

    it('adds them to one and takes them out of another', async () => {
        serve([collection({ account_id: 'me' }), collection({ id: 'c2', name: 'Night owls', account_id: 'me', items: [item('i7', 'dee', 'accepted')] })]);
        api.post.mockResolvedValue({ data: { collection_item: item('i8', 'dee', 'accepted') } });
        api.delete.mockResolvedValue({ data: {} });
        await sheet(dee);

        await fireEvent.press(await screen.findByRole('checkbox', { name: 'Pug artists' }));
        expect(api.post).toHaveBeenCalledWith('/collections/c1/items', { account_id: 'dee' });
        await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Night owls' })).toBeChecked());
        await fireEvent.press(screen.getByRole('checkbox', { name: 'Night owls' }));
        expect(api.delete).toHaveBeenCalledWith('/collections/c2/items/i7');
    });

    it('won’t add to a full collection', async () => {
        serve([collection({ account_id: 'me', item_count: 25 })]);
        await sheet(dee);
        expect(await screen.findByText('Full (25 accounts)')).toBeTruthy();
        expect(screen.getByRole('checkbox', { name: 'Pug artists' })).toBeDisabled();
    });

    it('makes a new collection with them in it', async () => {
        serve([]);
        const toast = jest.spyOn(dialog, 'toast').mockImplementation(() => {});
        api.post.mockResolvedValue({ data: { collection: collection({ name: 'Pugs' }) } });
        await sheet(dee);

        expect(await screen.findByText("You don't have any collections yet")).toBeTruthy();
        await fireEvent.press(screen.getByRole('button', { name: 'New collection' }));
        await fireEvent.changeText(screen.getByLabelText('Name'), ' Pugs ');
        await fireEvent.press(screen.getByRole('button', { name: 'Create and add' }));
        expect(api.post).toHaveBeenCalledWith('/collections', { name: 'Pugs', discoverable: true, account_ids: ['dee'] });
        await waitFor(() => expect(toast).toHaveBeenCalledWith('Dee is in your new collection Pugs'));
    });

    it('says why someone can’t be added', async () => {
        serve([collection({ account_id: 'me' })]);
        await sheet({ ...dee, feature_approval: { ...dee.feature_approval, current_user: 'denied' } });
        expect(screen.getByText("Dee doesn't allow being featured in collections")).toBeTruthy();
        expect(screen.queryByRole('checkbox')).toBeNull();

        await sheet({ ...dee, feature_approval: { ...dee.feature_approval, current_user: 'missing' } });
        expect(screen.getByText("Dee's server doesn't have collections yet")).toBeTruthy();
    });
});

describe('collection editor', () => {
    it('makes a new collection and opens it in place of the editor', async () => {
        api.post.mockResolvedValue({ data: { collection: collection({ id: 'c5', name: 'Pug artists' }) } });
        api.get.mockResolvedValue({ data: { collection: collection({ id: 'c5' }), accounts: [] } });
        await render(wrap(<CollectionEditor onBack={jest.fn()} />));

        await fireEvent.changeText(screen.getByLabelText('Name'), 'Pug artists');
        await fireEvent.changeText(screen.getByLabelText('Topic'), '#pug art');
        await fireEvent.press(screen.getByRole('button', { name: 'Create collection' }));

        expect(api.post).toHaveBeenCalledWith('/collections', { name: 'Pug artists', description: '', tag_name: 'pugart', discoverable: true, sensitive: false, account_ids: [] });
        await waitFor(() => expect(screen.getByTestId('stack').props.children).toContain('collection'));
    });

    it('saves changes to yours', async () => {
        api.get.mockResolvedValue({ data: { collection: collection(), accounts: [] } });
        api.patch.mockResolvedValue({ data: { collection: collection() } });
        const onBack = jest.fn();
        await render(wrap(<CollectionEditor collectionId="c1" onBack={onBack} />));

        await waitFor(() => expect(screen.getByLabelText('Name').props.value).toBe('Pug artists'));
        expect(screen.getByLabelText('Description').props.value).toBe('People who draw pugs');
        await fireEvent.changeText(screen.getByLabelText('Name'), 'Pug painters');
        await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

        expect(api.patch).toHaveBeenCalledWith('/collections/c1', { name: 'Pug painters', description: 'People who draw pugs', tag_name: 'pugart', discoverable: true, sensitive: false });
        await waitFor(() => expect(onBack).toHaveBeenCalled());
    });
});
