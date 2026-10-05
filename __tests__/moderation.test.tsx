import React from 'react';
import { Alert, Text } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils/queryClient';
import apiClient from '../services/api/client';
import { blockAccount, muteAccount, unblockAccount, unmuteAccount } from '../services/mastodon/accounts';
import { createReport, getRules } from '../services/mastodon/reports';
import { TootCard } from '../components/TootCard/tootCard';
import { MediaViewerProvider } from '../components/MediaViewer/mediaViewer';
import { ProfileHeader } from '../screens/Profile/profileHeader';
import Report from '../screens/Report/report';
import { NavigationProvider, useNavigator } from '../services/navigationContext';
import { Account, Relationship, Status } from '../services/mastodon/types';

jest.mock('../services/api/client', () => ({
    __esModule: true,
    default: { get: jest.fn(), post: jest.fn() },
}));
const me: Account = { id: 'me', username: 'me', acct: 'me', display_name: 'Me', avatar: '', emojis: [] };
jest.mock('../services/authContext', () => ({ useAuth: () => ({ user: me }), useOptionalAuth: () => ({ user: me }) }));
jest.mock('../services/themeContext', () => ({
    useTheme: () => jest.requireActual('../testUtils/theme').mockTheme,
}));
jest.mock('../services/settingsContext', () => ({
    useSettings: () => ({ compactMode: false, mediaAutoplay: false }),
}));
jest.mock('../services/composeContext', () => ({
    useCompose: () => ({ openCompose: jest.fn() }),
}));

const api = apiClient as unknown as Record<'get' | 'post', jest.Mock>;
const ana: Account = { id: 'ana', username: 'ana', acct: 'ana@art.social', display_name: 'Ana', avatar: '', emojis: [] };
const rules = [
    { id: '1', text: 'No hate speech' },
    { id: '2', text: 'No spam', hint: 'Including ads' },
];

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
        uri: 'https://art.social/statuses/p1',
        url: 'https://art.social/@ana/1',
        replies_count: 0,
        reblogs_count: 0,
        favourites_count: 0,
        content: '<p>Buy cheap pugs</p>',
        reblog: null,
        account: ana,
        media_attachments: [],
        emojis: [],
        ...extra,
    }) as Status;

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
const relationship = (extra: Partial<Relationship> = {}): Relationship => ({ id: 'ana', following: false, requested: false, followed_by: false, ...extra });
// Presses the destructive button of the last Alert
const confirmAlert = async () => {
    const [, , buttons] = (Alert.alert as jest.Mock).mock.calls.at(-1);
    await act(async () => buttons.find((button: { style?: string }) => button.style === 'destructive').onPress());
};

beforeEach(() => {
    jest.clearAllMocks();
    queryClient = createTestQueryClient();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    api.get.mockImplementation(async (url: string) => (url === '/instance/rules' ? { data: rules } : { data: [] }));
    api.post.mockImplementation(async (url: string) => ({ data: url === '/reports' ? {} : relationship({ blocking: url.endsWith('/block'), muting: url.endsWith('/mute') }) }));
});
afterEach(() => jest.restoreAllMocks());

describe('moderation services', () => {
    it('blocks, mutes and reports through Mastodon', async () => {
        await blockAccount('ana');
        await unblockAccount('ana');
        await muteAccount('ana');
        await unmuteAccount('ana');
        expect(await getRules()).toEqual(rules);
        await createReport({ account_id: 'ana', category: 'spam' });

        expect(api.post.mock.calls.map(call => call[0])).toEqual([
            '/accounts/ana/block',
            '/accounts/ana/unblock',
            '/accounts/ana/mute',
            '/accounts/ana/unmute',
            '/reports',
        ]);
        expect(api.post).toHaveBeenCalledWith('/accounts/ana/mute', { notifications: true });
    });
});

describe('Post menu', () => {
    const openMenu = async (status = post()) => {
        await render(wrap(<TootCard status={status} />));
        await fireEvent.press(screen.getByRole('button', { name: 'More options for this post' }));
    };

    it("offers editing instead on your own posts, and nothing in other servers' feeds", async () => {
        await render(wrap(<TootCard status={post({ account: me })} />));
        await fireEvent.press(screen.getByRole('button', { name: 'More options for this post' }));
        expect(await screen.findByRole('button', { name: 'Edit' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Report this post' })).toBeNull();

        await render(wrap(<TootCard status={post()} remote />));
        expect(screen.queryByRole('button', { name: 'More options for this post' })).toBeNull();
    });

    it('opens the report screen with the post', async () => {
        await openMenu();
        await fireEvent.press(await screen.findByRole('button', { name: 'Report this post' }));

        expect(JSON.parse(screen.getByTestId('stack').props.children)).toEqual(['report']);
    });

    it('mutes the author, and reloads timelines without them', async () => {
        const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
        await openMenu();
        await fireEvent.press(await screen.findByRole('button', { name: 'Mute @ana@art.social' }));

        await waitFor(() => expect(api.post).toHaveBeenCalledWith('/accounts/ana/mute', { notifications: true }));
        await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('You muted @ana@art.social'));
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ['timeline'] });
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ['notifications'] });
    });

    it('asks before blocking', async () => {
        await openMenu();
        await fireEvent.press(await screen.findByRole('button', { name: 'Block @ana@art.social' }));

        expect(Alert.alert).toHaveBeenCalledWith('Block @ana@art.social?', expect.any(String), expect.any(Array));
        expect(api.post).not.toHaveBeenCalled();
        await confirmAlert();

        expect(api.post).toHaveBeenCalledWith('/accounts/ana/block');
    });
});

describe('Profile menu', () => {
    const renderHeader = (rel?: Relationship) =>
        render(wrap(<ProfileHeader user={ana} mode="other" tabs={[{ value: 'posts', label: 'Posts' }]} tab="posts" onChangeTab={jest.fn()} relationship={rel} />));

    it('offers report, mute and block', async () => {
        await renderHeader(relationship());
        await fireEvent.press(screen.getByRole('button', { name: 'More options for Ana' }));

        expect(await screen.findByRole('button', { name: 'Report @ana@art.social' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Mute @ana@art.social' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Block @ana@art.social' })).toBeTruthy();
    });

    it('undoes a mute or a block', async () => {
        await renderHeader(relationship({ muting: true, blocking: true }));
        await fireEvent.press(screen.getByRole('button', { name: 'More options for Ana' }));

        await fireEvent.press(await screen.findByRole('button', { name: 'Unmute @ana@art.social' }));
        expect(api.post).toHaveBeenCalledWith('/accounts/ana/unmute');
        await fireEvent.press(screen.getByRole('button', { name: 'More options for Ana' }));
        await fireEvent.press(await screen.findByRole('button', { name: 'Unblock @ana@art.social' }));
        expect(api.post).toHaveBeenCalledWith('/accounts/ana/unblock');
    });
});

describe('Report screen', () => {
    // null: reporting the account, with no post
    const renderReport = (account = ana, status: Status | null = post()) =>
        render(wrap(<Report account={account} status={status ?? undefined} onBack={jest.fn()} />));

    it('reports a post as spam, forwarding to their server', async () => {
        await renderReport();

        expect(screen.getByText('Buy cheap pugs')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Send report' })).toBeDisabled();
        await fireEvent.press(screen.getByRole('radio', { name: "It's spam" }));
        await fireEvent.changeText(screen.getByLabelText('Anything else moderators should know (optional)'), ' Bot ');
        await fireEvent(screen.getByLabelText('Also send to art.social'), 'valueChange', true);
        await fireEvent.press(screen.getByRole('button', { name: 'Send report' }));

        expect(api.post).toHaveBeenCalledWith('/reports', {
            account_id: 'ana',
            status_ids: ['p1'],
            comment: 'Bot',
            forward: true,
            category: 'spam',
            rule_ids: undefined,
        });
        expect(await screen.findByText('Report sent')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Block @ana@art.social' })).toBeTruthy();
    });

    it('needs at least one rule for a rules violation', async () => {
        await renderReport({ ...ana, acct: 'ana' }, null);

        await fireEvent.press(await screen.findByRole('radio', { name: 'It breaks server rules' }));
        expect(screen.getByRole('button', { name: 'Send report' })).toBeDisabled();
        expect(screen.queryByLabelText(/Also send to/)).toBeNull();
        await fireEvent.press(screen.getByRole('checkbox', { name: 'No spam' }));
        await fireEvent.press(screen.getByRole('button', { name: 'Send report' }));

        expect(api.post).toHaveBeenCalledWith('/reports', expect.objectContaining({ category: 'violation', rule_ids: ['2'], status_ids: undefined, forward: undefined }));
    });

    it("leaves out rules when the server has none, and says when sending fails", async () => {
        api.get.mockResolvedValue({ data: [] });
        api.post.mockRejectedValue(new Error('offline'));
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        await renderReport();

        await screen.findByRole('radio', { name: "It's illegal" });
        expect(screen.queryByRole('radio', { name: 'It breaks server rules' })).toBeNull();
        await fireEvent.press(screen.getByRole('radio', { name: 'Something else' }));
        await fireEvent.press(screen.getByRole('button', { name: 'Send report' }));

        expect(await screen.findByText("That didn't work. Try again.")).toBeTruthy();
        expect(screen.queryByText('Report sent')).toBeNull();
    });
});
