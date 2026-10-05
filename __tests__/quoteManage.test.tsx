import React from 'react';
import { Alert, Text } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils/queryClient';
import apiClient from '../services/api/client';
import { currentQuotePolicy, getQuotes, nextMaxIdFromLink, revokeQuote, setQuotePolicy } from '../services/mastodon/quotes';
import { updateDefaultQuotePolicy } from '../services/mastodon/accounts';
import { TootCard } from '../components/TootCard/tootCard';
import { MediaViewerProvider } from '../components/MediaViewer/mediaViewer';
import Quotes from '../screens/Quotes/quotes';
import Settings from '../screens/Settings/settings';
import Thread from '../screens/Thread/thread';
import { NavigationProvider, useNavigator } from '../services/navigationContext';
import { Account, QuoteApproval, Status } from '../services/mastodon/types';

jest.mock('../services/api/client', () => ({
    __esModule: true,
    default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock('../services/storage', () => ({
    getCredentials: async () => ({ accessToken: 'token', instanceUrl: 'https://home.social' }),
}));
const me: Account = { id: 'me', username: 'me', acct: 'me', display_name: 'Me', avatar: '', emojis: [], source: { quote_policy: 'public' } };
const mockUpdateUser = jest.fn();
jest.mock('../services/authContext', () => ({
    useAuth: () => ({ user: me, savedAccounts: [], logout: jest.fn(), switchAccount: jest.fn(), setAddingAccount: jest.fn(), updateUser: mockUpdateUser }),
    useOptionalAuth: () => ({ user: me }),
}));
jest.mock('../services/themeContext', () => ({
    useTheme: () => jest.requireActual('../testUtils/theme').mockTheme,
}));
jest.mock('../services/settingsContext', () => ({
    useSettings: () => ({ compactMode: false, mediaAutoplay: false, notifications: true, setNotifications: jest.fn(), setMediaAutoplay: jest.fn(), setCompactMode: jest.fn() }),
}));
jest.mock('../services/composeContext', () => ({
    useCompose: () => ({ openCompose: jest.fn() }),
}));
jest.mock('../services/mastodon/instance', () => ({
    ...jest.requireActual('../services/mastodon/instance'),
    fetchInstanceConfiguration: jest.fn(async () => ({ ...jest.requireActual('../services/mastodon/instance').DEFAULT_INSTANCE_CONFIGURATION, supportsQuotes: true })),
}));

const api = apiClient as unknown as Record<'get' | 'post' | 'put' | 'patch' | 'delete', jest.Mock>;
const ana: Account = { id: 'ana', username: 'ana', acct: 'ana', display_name: 'Ana', avatar: '', emojis: [] };
const approval = (automatic: string[]): QuoteApproval => ({ automatic, manual: [], current_user: 'automatic' });

const post = (extra: Partial<Status> = {}): Status =>
    ({
        id: 'p1',
        created_at: new Date().toISOString(),
        in_reply_to_id: null,
        in_reply_to_account_id: null,
        sensitive: false,
        spoiler_text: '',
        visibility: 'public',
        language: 'en',
        uri: 'https://home.social/statuses/p1',
        url: 'https://home.social/@me/p1',
        replies_count: 0,
        reblogs_count: 0,
        favourites_count: 0,
        content: '<p>Pugs rule</p>',
        reblog: null,
        account: me,
        media_attachments: [],
        emojis: [],
        ...extra,
    }) as Status;
const quoting = (id: string, account = ana) => post({ id, account, content: `<p>quote ${id}</p>`, quote: { state: 'accepted', quoted_status: post() } });

let queryClient: QueryClient;
const StackProbe = () => <Text testID="stack">{JSON.stringify(useNavigator().stack.map(entry => entry.route.name))}</Text>;
const wrap = (children: React.ReactNode) => (
    <QueryClientProvider client={queryClient}>
        <NavigationProvider>
            <MediaViewerProvider>
                {children}
                <StackProbe />
            </MediaViewerProvider>
        </NavigationProvider>
    </QueryClientProvider>
);
const stack = () => JSON.parse(screen.getByTestId('stack').props.children);

beforeEach(() => {
    jest.clearAllMocks();
    queryClient = createTestQueryClient();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    api.get.mockResolvedValue({ data: [], headers: {} });
    api.post.mockResolvedValue({ data: {} });
    api.put.mockImplementation(async (_url: string, body: { quote_approval_policy: string }) => ({
        data: post({ quote_approval: approval(body.quote_approval_policy === 'followers' ? ['followers'] : []) }),
    }));
    api.patch.mockResolvedValue({ data: { ...me, source: { quote_policy: 'followers' } } });
});
afterEach(() => jest.restoreAllMocks());

describe('quote services', () => {
    it('pages quotes with the Link header', async () => {
        expect(nextMaxIdFromLink('<https://x/api/v1/statuses/1/quotes?limit=20&max_id=123>; rel="next", <https://x/api/v1/statuses/1/quotes?since_id=9>; rel="prev"')).toBe('123');
        expect(nextMaxIdFromLink('<https://x/?since_id=9>; rel="prev"')).toBeUndefined();
        expect(nextMaxIdFromLink(undefined)).toBeUndefined();

        const quote = quoting('q1');
        api.get.mockResolvedValue({ data: [quote], headers: { link: '<https://x/quotes?max_id=55>; rel="next"' } });
        expect(await getQuotes('p1', '77')).toEqual({ statuses: [quote], nextMaxId: '55' });
        expect(api.get).toHaveBeenCalledWith('/statuses/p1/quotes', { params: { max_id: '77' } });
    });

    it('revokes quotes and changes who can quote', async () => {
        await revokeQuote('p1', 'q1');
        await setQuotePolicy('p1', 'followers');
        await updateDefaultQuotePolicy('nobody');

        expect(api.post).toHaveBeenCalledWith('/statuses/p1/quotes/q1/revoke');
        expect(api.put).toHaveBeenCalledWith('/statuses/p1/interaction_policy', { quote_approval_policy: 'followers' });
        expect(api.patch).toHaveBeenCalledWith('/accounts/update_credentials', { source: { quote_policy: 'nobody' } });
    });

    it("reads a post's policy back from its approval", () => {
        expect(currentQuotePolicy(post({ quote_approval: approval(['public']) }))).toBe('public');
        expect(currentQuotePolicy(post({ quote_approval: { automatic: [], manual: ['followers'], current_user: 'manual' } }))).toBe('followers');
        expect(currentQuotePolicy(post({ quote_approval: approval([]) }))).toBe('nobody');
    });
});

describe('Quotes screen', () => {
    it('lists the quotes of your post and removes one', async () => {
        api.get.mockResolvedValue({ data: [quoting('q1'), quoting('q2')], headers: {} });
        await render(wrap(<Quotes status={post()} onBack={jest.fn()} onStatusPress={jest.fn()} />));

        expect(await screen.findByText('quote q1')).toBeTruthy();
        await fireEvent.press(screen.getAllByRole('button', { name: 'Remove quote' })[0]);
        const [title, , buttons] = (Alert.alert as jest.Mock).mock.calls[0];
        expect(title).toBe('Remove this quote?');
        await act(async () => buttons.find((button: { style?: string }) => button.style === 'destructive').onPress());

        expect(api.post).toHaveBeenCalledWith('/statuses/p1/quotes/q1/revoke');
        await waitFor(() => expect(screen.queryByText('quote q1')).toBeNull());
        expect(screen.getByText('quote q2')).toBeTruthy();
    });

    it("doesn't offer removing quotes of someone else's post", async () => {
        api.get.mockResolvedValue({ data: [quoting('q1', me)], headers: {} });
        await render(wrap(<Quotes status={post({ account: ana })} onBack={jest.fn()} onStatusPress={jest.fn()} />));

        expect(await screen.findByText('quote q1')).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Remove quote' })).toBeNull();
    });

    it('says when nobody has quoted it', async () => {
        await render(wrap(<Quotes status={post()} onBack={jest.fn()} onStatusPress={jest.fn()} />));
        expect(await screen.findByText('Nobody has quoted this post yet')).toBeTruthy();
    });
});

describe('Post menu', () => {
    const openMenu = async (status: Status) => {
        await render(wrap(<TootCard status={status} />));
        await fireEvent.press(screen.getByRole('button', { name: 'More options for this post' }));
    };

    it('opens the quotes of a quoted post, yours or not', async () => {
        await openMenu(post({ account: ana, quotes_count: 2 }));
        await fireEvent.press(await screen.findByRole('button', { name: 'See 2 quotes' }));

        expect(stack()).toEqual(['quotes']);
    });

    it('changes who can quote your post', async () => {
        await openMenu(post({ quote_approval: approval(['public']) }));
        await fireEvent.press(await screen.findByRole('button', { name: 'Who can quote' }));
        await fireEvent.press(await screen.findByRole('radio', { name: /^Followers/ }));

        await waitFor(() => expect(api.put).toHaveBeenCalledWith('/statuses/p1/interaction_policy', { quote_approval_policy: 'followers' }));
    });

    it("doesn't offer it for followers-only posts or servers without quotes", async () => {
        await openMenu(post({ visibility: 'private', quote_approval: approval([]) }));
        expect(await screen.findByRole('button', { name: 'Edit' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Who can quote' })).toBeNull();
    });
});

describe('Who can quote your posts, by default', () => {
    it('is a setting saved on your account', async () => {
        await render(wrap(<Settings onBack={jest.fn()} />));

        await fireEvent.press(await screen.findByRole('button', { name: 'Who can quote your posts: Anyone' }));
        await fireEvent.press(await screen.findByRole('radio', { name: /^Followers/ }));

        await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/accounts/update_credentials', { source: { quote_policy: 'followers' } }));
        expect(mockUpdateUser).toHaveBeenCalledWith(expect.objectContaining({ source: { quote_policy: 'followers' } }));
    });
});

describe('Thread', () => {
    it('says how often its post was quoted, and opens the quotes', async () => {
        api.get.mockImplementation(async (url: string) => {
            if (url === '/statuses/p1') return { data: post({ quotes_count: 3 }) };
            if (url === '/statuses/p1/context') return { data: { ancestors: [], descendants: [] } };
            return { data: [], headers: {} };
        });
        await render(wrap(<Thread statusId="p1" onBack={jest.fn()} onStatusPress={jest.fn()} />));

        await fireEvent.press(await screen.findByRole('button', { name: '3 quotes' }));

        expect(stack()).toEqual(['quotes']);
    });
});
