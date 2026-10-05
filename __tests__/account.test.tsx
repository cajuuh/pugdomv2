import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { createTestQueryClient } from '../testUtils/queryClient';
import Account from '../screens/Account/account';
import { FollowButton } from '../components/FollowButton/followButton';
import { mentionFor, useOpenAccount } from '../hooks/useOpenAccount';
import { NavigationProvider, useNavigator } from '../services/navigationContext';
import { followAccount, getAccount, getAccountStatuses, getRelationships, unfollowAccount } from '../services/mastodon/accounts';
import { resolveAccount } from '../services/mastodon/search';
import { Account as AccountType, Relationship, Status } from '../services/mastodon/types';

const me: AccountType = { id: 'me', username: 'pedro', acct: 'pedro', display_name: 'Pedro', avatar: '', emojis: [], url: 'https://pug.social/@pedro' };
const ana: AccountType = {
    id: 'ana',
    username: 'ana',
    acct: 'ana@art.social',
    display_name: 'Ana',
    avatar: '',
    emojis: [],
    url: 'https://art.social/@ana',
    note: '<p>draws pugs</p>',
    statuses_count: 12,
    following_count: 3,
    followers_count: 40,
};

jest.mock('../services/authContext', () => ({
    useAuth: () => ({ user: { id: 'me', username: 'pedro', acct: 'pedro', display_name: 'Pedro', avatar: '', emojis: [] } }),
}));
jest.mock('../services/themeContext', () => ({
    useTheme: () => jest.requireActual('../testUtils/theme').mockTheme,
}));
jest.mock('../services/storage', () => ({
    getCredentials: jest.fn().mockResolvedValue({ accessToken: 't', instanceUrl: 'https://pug.social' }),
}));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
jest.mock('../services/mastodon/accounts', () => ({
    getAccount: jest.fn(),
    getAccountStatuses: jest.fn(),
    getRelationships: jest.fn(),
    followAccount: jest.fn(),
    unfollowAccount: jest.fn(),
}));
jest.mock('../services/mastodon/search', () => ({ resolveAccount: jest.fn() }));
jest.mock('../components/TootCard/tootCard', () => ({
    TootCard: ({ status }: { status: Status }) => {
        const { Text: MockText } = jest.requireActual('react-native');
        return <MockText>{status.content}</MockText>;
    },
}));

const mocked = {
    getAccount: getAccount as jest.Mock,
    getAccountStatuses: getAccountStatuses as jest.Mock,
    getRelationships: getRelationships as jest.Mock,
    follow: followAccount as jest.Mock,
    unfollow: unfollowAccount as jest.Mock,
    resolve: resolveAccount as jest.Mock,
};
const relationship = (overrides: Partial<Relationship> = {}): Relationship => ({
    id: 'ana',
    following: false,
    requested: false,
    followed_by: false,
    ...overrides,
});

const withQuery = (children: React.ReactNode) => (
    <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>
);

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mocked.getAccount.mockResolvedValue(ana);
    mocked.getAccountStatuses.mockResolvedValue([{ id: 's1', content: 'post s1' }]);
    mocked.getRelationships.mockResolvedValue([relationship()]);
});
afterEach(() => jest.restoreAllMocks());

describe('Account screen', () => {
    const renderAccount = (props: Partial<React.ComponentProps<typeof Account>> = {}) =>
        render(withQuery(<Account accountId="ana" onBack={jest.fn()} onStatusPress={jest.fn()} onSettingsPress={jest.fn()} {...props} />));

    it("shows someone else's profile with their posts and a follow button", async () => {
        await renderAccount({ account: ana });

        expect(screen.getByRole('header', { name: 'Ana' })).toBeTruthy();
        expect(screen.getByText('@ana@art.social')).toBeTruthy();
        expect(await screen.findByText('post s1')).toBeTruthy();
        expect(await screen.findByRole('button', { name: 'Follow' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Edit profile' })).toBeNull();
        expect(mocked.getAccountStatuses).toHaveBeenCalledWith('ana', undefined, { exclude_replies: true });
    });

    it('loads the profile when only the id is known', async () => {
        await renderAccount();

        expect(await screen.findByRole('header', { name: 'Ana' })).toBeTruthy();
        expect(mocked.getAccount).toHaveBeenCalledWith('ana');
    });

    it('says when they follow you and links to their own server', async () => {
        mocked.getRelationships.mockResolvedValue([relationship({ followed_by: true })]);
        await renderAccount({ account: ana });

        expect(await screen.findByText('Follows you')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Follow back' })).toBeTruthy();

        await fireEvent.press(screen.getByRole('link', { name: 'See on art.social' }));
        expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://art.social/@ana');
    });

    it('goes back with its arrow', async () => {
        const onBack = jest.fn();
        await renderAccount({ account: ana, onBack });

        await fireEvent.press(screen.getByRole('button', { name: 'Back' }));

        expect(onBack).toHaveBeenCalled();
    });

    it('shows your own profile with edit and settings instead of follow', async () => {
        mocked.getAccount.mockResolvedValue(me);
        await render(withQuery(<Account accountId="me" account={me} onBack={jest.fn()} onStatusPress={jest.fn()} onSettingsPress={jest.fn()} />));

        expect(await screen.findByRole('button', { name: 'Edit profile' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Settings' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Follow' })).toBeNull();
        expect(mocked.getRelationships).not.toHaveBeenCalled();
    });
});

describe('FollowButton', () => {
    const renderButton = (props: Partial<React.ComponentProps<typeof FollowButton>> = {}) =>
        render(withQuery(<FollowButton accountId="ana" name="Ana" relationship={relationship()} {...props} />));

    it('stays hidden until the relationship is known', async () => {
        await renderButton({ relationship: undefined });
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('follows', async () => {
        mocked.follow.mockResolvedValue(relationship({ following: true }));
        await renderButton();

        await fireEvent.press(screen.getByRole('button', { name: 'Follow' }));

        expect(mocked.follow).toHaveBeenCalledWith('ana');
    });

    it('asks before unfollowing', async () => {
        mocked.unfollow.mockResolvedValue(relationship());
        await renderButton({ relationship: relationship({ following: true }), allowUnfollow: true });

        await fireEvent.press(screen.getByRole('button', { name: 'Following' }));
        const [title, , buttons] = (Alert.alert as jest.Mock).mock.calls[0];
        expect(title).toBe('Unfollow Ana?');
        expect(mocked.unfollow).not.toHaveBeenCalled();

        await act(async () => {
            buttons.find((b: any) => b.style === 'destructive').onPress();
        });
        expect(mocked.unfollow).toHaveBeenCalledWith('ana');
    });

    it('offers to cancel a pending request', async () => {
        await renderButton({ relationship: relationship({ requested: true }), allowUnfollow: true });

        await fireEvent.press(screen.getByRole('button', { name: 'Requested' }));

        expect((Alert.alert as jest.Mock).mock.calls[0][0]).toBe('Cancel your follow request to Ana?');
    });

    it('only shows the state where unfollowing is not offered', async () => {
        await renderButton({ relationship: relationship({ following: true }) });

        expect(screen.queryByRole('button')).toBeNull();
        expect(screen.getByLabelText('Following')).toBeTruthy();
    });
});

describe('opening profiles from mentions', () => {
    const mentions = [{ id: 'ana', username: 'ana', acct: 'ana@art.social', url: 'https://art.social/@ana' }];

    const renderOpen = () =>
        renderHook(() => ({ open: useOpenAccount(), nav: useNavigator() }), {
            wrapper: ({ children }) => <NavigationProvider>{children}</NavigationProvider>,
        });

    it('finds the account in the post mentions by its URL', () => {
        expect(mentionFor(mentions, 'https://art.social/@ana')?.id).toBe('ana');
        expect(mentionFor(mentions, 'https://art.social/@ana/')?.id).toBe('ana');
        expect(mentionFor(mentions, 'https://art.social/@bob')).toBeUndefined();
    });

    it('opens a mentioned account directly', async () => {
        const { result } = await renderHook(() => ({ open: useOpenAccount(), nav: useNavigator() }), {
            wrapper: ({ children }) => <NavigationProvider>{children}</NavigationProvider>,
        });

        await act(async () => {
            await result.current.open.openMention('https://art.social/@ana', mentions);
        });

        expect(result.current.nav.stack.map(entry => entry.route)).toEqual([{ name: 'account', accountId: 'ana' }]);
        expect(mocked.resolve).not.toHaveBeenCalled();
    });

    it('looks up an unknown mention on our server', async () => {
        mocked.resolve.mockResolvedValue(ana);
        const { result } = await renderOpen();

        await act(async () => {
            await result.current.open.openMention('https://art.social/@ana');
        });

        expect(mocked.resolve).toHaveBeenCalledWith('https://art.social/@ana');
        expect(result.current.nav.stack[0].route).toEqual({ name: 'account', accountId: 'ana', account: ana });
    });

    it('falls back to the website when nothing is found', async () => {
        mocked.resolve.mockResolvedValue(null);
        const { result } = await renderOpen();

        await act(async () => {
            await result.current.open.openMention('https://art.social/@nobody');
        });

        expect(result.current.nav.stack).toHaveLength(0);
        expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://art.social/@nobody');
    });
});
