import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils/queryClient';
import apiClient from '../services/api/client';
import { featuredAccounts, getAccountCollections, getCollection } from '../services/mastodon/collections';
import { useAccountCollections } from '../hooks/useCollections';
import { CollectionCards } from '../components/CollectionCards/collectionCards';
import Collection from '../screens/Collection/collection';
import { NavigationProvider, useNavigator } from '../services/navigationContext';
import { Account, Collection as CollectionType, CollectionItem } from '../services/mastodon/types';

jest.mock('../services/api/client', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() }, publicClient: { get: jest.fn() } }));
jest.mock('../services/storage', () => ({ getCredentials: jest.fn().mockResolvedValue({ accessToken: 't', instanceUrl: 'https://pug.social' }) }));
const mockMe = { current: { id: 'me', username: 'me', acct: 'me', display_name: 'Me', avatar: '', emojis: [] } as Account };
jest.mock('../services/authContext', () => ({ useAuth: () => ({ user: mockMe.current }), useOptionalAuth: () => ({ user: mockMe.current }) }));
jest.mock('../services/themeContext', () => ({ useTheme: () => jest.requireActual('../testUtils/theme').mockTheme }));
jest.mock('../services/settingsContext', () => ({ useOptionalSettings: () => null, useSettings: () => ({ hideCounts: false }) }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(() => Promise.resolve()) }));

const api = apiClient as unknown as Record<'get' | 'post', jest.Mock>;
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
