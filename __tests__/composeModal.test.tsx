import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils/queryClient';
import ComposeModal, { defaultVisibility, hasDraft, keyboardInset } from '../components/ComposeModal/composeModal';
import { OptionSheet } from '../components/ComposeModal/optionSheet';
import { shouldDismiss } from '../components/ComposeModal/sheetTransition';
import { counterState } from '../components/ComposeModal/characterCounter';
import { fetchCustomEmojis } from '../services/mastodon/customEmojis';
import { createStatus } from '../services/mastodon/statuses';
import { DEFAULT_INSTANCE_CONFIGURATION, fetchInstanceConfiguration } from '../services/mastodon/instance';
import { Account, Status } from '../services/mastodon/types';

const me: Account = { id: '1', username: 'me', acct: 'me', display_name: 'Me', avatar: '', emojis: [], source: { language: 'pt' } };

jest.mock('../services/authContext', () => ({
    useAuth: () => ({ user: me }),
}));

jest.mock('../services/themeContext', () => ({
    useTheme: () => jest.requireActual('../testUtils/theme').mockTheme,
}));

jest.mock('../services/mastodon/statuses', () => ({
    createStatus: jest.fn(),
}));

jest.mock('../services/mastodon/customEmojis', () => ({
    fetchCustomEmojis: jest.fn(),
}));

jest.mock('../services/mastodon/instance', () => ({
    ...jest.requireActual('../services/mastodon/instance'),
    fetchInstanceConfiguration: jest.fn(),
}));

const mockedCreateStatus = createStatus as jest.MockedFunction<typeof createStatus>;
const mockedInstance = fetchInstanceConfiguration as jest.MockedFunction<typeof fetchInstanceConfiguration>;
const mockedEmojis = fetchCustomEmojis as jest.MockedFunction<typeof fetchCustomEmojis>;

const bob: Account = { id: '2', username: 'bob', acct: 'bob@other.social', display_name: 'Bob', avatar: '', emojis: [] };

const replyTarget = {
    id: 's1',
    account: bob,
    content: '<p>hello @me</p>',
    visibility: 'public',
    mentions: [{ id: '1', username: 'me', acct: 'me', url: '' }, { id: '3', username: 'carol', acct: 'carol', url: '' }],
} as unknown as Status;

describe('ComposeModal', () => {
    let queryClient: QueryClient;

    const renderCompose = (replyToStatus: Status | null = null) => {
        queryClient = createTestQueryClient();
        return render(
            <QueryClientProvider client={queryClient}>
                <ComposeModal isOpen replyToStatus={replyToStatus} closeCompose={jest.fn()} />
            </QueryClientProvider>
        );
    };

    const composer = () => screen.getByPlaceholderText(/What's on your mind\?|Write your reply/);

    beforeEach(() => {
        jest.clearAllMocks();
        mockedCreateStatus.mockResolvedValue({} as Status);
        mockedInstance.mockResolvedValue({ ...DEFAULT_INSTANCE_CONFIGURATION, maxCharacters: 500, maxPollOptions: 4, maxCharactersPerPollOption: 50 });
    });

    it('does not load instance limits while closed', async () => {
        queryClient = createTestQueryClient();
        await render(
            <QueryClientProvider client={queryClient}>
                <ComposeModal isOpen={false} replyToStatus={null} closeCompose={jest.fn()} />
            </QueryClientProvider>
        );

        expect(mockedInstance).not.toHaveBeenCalled();
    });

    it('starts a reply with the author and other mentioned accounts by full acct', async () => {
        await renderCompose(replyTarget);

        expect(composer().props.value).toBe('@bob@other.social @carol ');
        expect(screen.getByText('@bob@other.social')).toBeTruthy();
    });

    it("posts in the account's default language as an ISO 639-1 code", async () => {
        await renderCompose();

        await fireEvent.changeText(composer(), 'Olá');
        await fireEvent.press(screen.getByText('Post'));

        expect(mockedCreateStatus).toHaveBeenCalledWith(expect.objectContaining({ status: 'Olá', language: 'pt' }));
    });

    it('counts URLs as 23 characters against the instance limit', async () => {
        mockedInstance.mockResolvedValue({ ...DEFAULT_INSTANCE_CONFIGURATION, maxCharacters: 1000, maxPollOptions: 4, maxCharactersPerPollOption: 50 });
        await renderCompose();
        await screen.findByText('1000');

        await fireEvent.changeText(composer(), `hi https://example.social/${'a'.repeat(200)}`);
        expect(screen.getByText(String(1000 - 3 - 23))).toBeTruthy();
    });

    it('does not publish a poll with fewer than two choices', async () => {
        await renderCompose();

        await fireEvent.changeText(composer(), 'Which one?');
        await fireEvent.press(screen.getByRole('button', { name: 'Poll' }));
        await fireEvent.changeText(screen.getByPlaceholderText('Choice 1'), 'Tea');

        expect(screen.getByText('Add at least 2 choices')).toBeTruthy();
        await fireEvent.press(screen.getByText('Post'));
        expect(mockedCreateStatus).not.toHaveBeenCalled();
    });

    it('rejects duplicate poll choices and publishes once they differ', async () => {
        await renderCompose();

        await fireEvent.changeText(composer(), 'Which one?');
        await fireEvent.press(screen.getByRole('button', { name: 'Poll' }));
        await fireEvent.changeText(screen.getByPlaceholderText('Choice 1'), 'Tea');
        await fireEvent.changeText(screen.getByPlaceholderText('Choice 2'), ' Tea ');
        expect(screen.getByText('Choices must be different')).toBeTruthy();

        await fireEvent.changeText(screen.getByPlaceholderText('Choice 2'), 'Coffee');
        await fireEvent.press(screen.getByText('Post'));
        expect(mockedCreateStatus).toHaveBeenCalledWith(
            expect.objectContaining({ poll: expect.objectContaining({ options: ['Tea', 'Coffee'] }) })
        );
    });
    it('sends the visibility picked from the pill', async () => {
        await renderCompose();

        await fireEvent.changeText(composer(), 'For my followers');
        await fireEvent.press(screen.getByRole('button', { name: 'Visibility: Public' }));
        await fireEvent.press(screen.getByRole('radio', { name: /^Followers/ }));
        expect(screen.getByRole('button', { name: 'Visibility: Followers' })).toBeTruthy();

        await fireEvent.press(screen.getByText('Post'));
        expect(mockedCreateStatus).toHaveBeenCalledWith(expect.objectContaining({ visibility: 'private' }));
    });

    it("replies with the parent's visibility", async () => {
        await renderCompose({ ...replyTarget, visibility: 'unlisted' } as Status);

        expect(screen.getByRole('button', { name: 'Visibility: Unlisted' })).toBeTruthy();
        await fireEvent.press(screen.getByText('Post'));
        expect(mockedCreateStatus).toHaveBeenCalledWith(expect.objectContaining({ visibility: 'unlisted', in_reply_to_id: 's1' }));
    });

    it('defaults new posts to the account default visibility', () => {
        expect(defaultVisibility({ ...me, source: { privacy: 'private' } }, null)).toBe('private');
        expect(defaultVisibility(me, null)).toBe('public');
        expect(defaultVisibility({ ...me, source: { privacy: 'private' } }, { ...replyTarget, visibility: 'direct' } as Status)).toBe('direct');
    });

    it('warns near the limit and blocks posting over it', async () => {
        mockedInstance.mockResolvedValue({ ...DEFAULT_INSTANCE_CONFIGURATION, maxCharacters: 30, maxPollOptions: 4, maxCharactersPerPollOption: 50 });
        await renderCompose();
        await screen.findByText('30');

        await fireEvent.changeText(composer(), 'a'.repeat(15));
        expect(screen.getByLabelText('15 characters left')).toBeTruthy();

        await fireEvent.changeText(composer(), 'a'.repeat(42));
        expect(screen.getByText('12 over')).toBeTruthy();
        expect(screen.getByLabelText('12 characters over the limit')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Post' })).toBeDisabled();
        await fireEvent.press(screen.getByText('Post'));
        expect(mockedCreateStatus).not.toHaveBeenCalled();
    });

    it.each([
        [438, 'plenty'],
        [20, 'plenty'],
        [19, 'near'],
        [0, 'near'],
        [-1, 'over'],
    ] as const)('treats %i characters left as %s', (remaining, state) => {
        expect(counterState(remaining)).toBe(state);
    });

    it('marks active tools as selected', async () => {
        await renderCompose();

        expect(screen.getByRole('button', { name: 'Content warning' })).not.toBeSelected();
        await fireEvent.press(screen.getByRole('button', { name: 'Content warning' }));
        expect(screen.getByRole('button', { name: 'Content warning' })).toBeSelected();
    });

    it('asks for the content warning text and focuses it when the tool is turned on', async () => {
        await renderCompose();

        await fireEvent.press(screen.getByRole('button', { name: 'Content warning' }));

        const field = screen.getByPlaceholderText('Write your warning');
        expect(field.props.autoFocus).toBe(true);
        expect(field.props.accessibilityHint).toBeTruthy();
    });

    it('only counts real changes as a draft worth confirming before a swipe-away', () => {
        const empty = { text: '', initialText: '', showPoll: false, spoilerText: '' };
        expect(hasDraft(empty)).toBe(false);
        // A reply that still only has the mentions it opened with
        expect(hasDraft({ ...empty, text: '@bob@other.social ', initialText: '@bob@other.social ' })).toBe(false);
        expect(hasDraft({ ...empty, text: 'hello' })).toBe(true);
        expect(hasDraft({ ...empty, showPoll: true })).toBe(true);
        expect(hasDraft({ ...empty, spoilerText: 'spoilers' })).toBe(true);
    });

    it.each([
        [40, 0.2, false],
        [40, 1.5, true],
        [150, 0, true],
        [-200, -3, false],
    ])('dismisses a sheet dragged %ipx at %f px/ms: %s', (dy, vy, dismissed) => {
        expect(shouldDismiss(dy, vy)).toBe(dismissed);
    });

    // Android drops views that draw nothing; the drag handle would vanish and only touches on its buttons would drag
    const dragHandleOf = (element: any) => {
        let node = element;
        while (node && !node.props.onMoveShouldSetResponder) node = node.parent;
        return node;
    };

    it('keeps the compose drag handle as a real view around the title', async () => {
        await renderCompose();

        const handle = dragHandleOf(screen.getByRole('header', { name: 'New post' }));
        expect(handle).toBeTruthy();
        expect(handle.props.collapsable).toBe(false);
        // Claims the touch as it starts, before a view higher up can (then only drags from Cancel worked)
        expect(handle.props.onStartShouldSetResponder({})).toBe(true);
    });

    it('keeps the picker drag handle as a real view around its title', async () => {
        await render(
            <OptionSheet visible title="Who can see this" options={[{ value: 'public', label: 'Public' }]} value="public" onSelect={jest.fn()} onClose={jest.fn()} />
        );

        const handle = dragHandleOf(screen.getByRole('header', { name: 'Who can see this' }));
        expect(handle).toBeTruthy();
        expect(handle.props.collapsable).toBe(false);
    });

    it('pads the sheet by exactly what the keyboard covers', () => {
        // Measured on a Galaxy S24 Ultra (832dp window, keyboard top at 511.6dp)
        expect(keyboardInset(832, 511.6)).toBeCloseTo(320.4);
        // A keyboard reported below the window covers nothing
        expect(keyboardInset(832, 900)).toBe(0);
    });

    it('fades the picker backdrop instead of sliding the whole modal up', async () => {
        await render(
            <OptionSheet visible title="Who can see this" options={[{ value: 'public', label: 'Public' }]} value="public" onSelect={jest.fn()} onClose={jest.fn()} />
        );

        const modal = screen.toJSON() as { type: string; props: { animationType?: string } };
        expect(modal.type).toBe('Modal');
        expect(modal.props.animationType).toBe('none');
        expect(screen.getByRole('radio', { name: 'Public' })).toBeTruthy();
    });

    it('removes the poll from the poll editor', async () => {
        await renderCompose();

        await fireEvent.press(screen.getByRole('button', { name: 'Poll' }));
        expect(screen.getByPlaceholderText('Choice 1')).toBeTruthy();
        await fireEvent.press(screen.getByRole('button', { name: 'Remove poll' }));

        expect(screen.queryByPlaceholderText('Choice 1')).toBeNull();
        expect(screen.getByRole('button', { name: 'Poll' })).not.toBeSelected();
    });

    it('sends the poll length picked from the duration pill', async () => {
        await renderCompose();

        await fireEvent.changeText(composer(), 'Which one?');
        await fireEvent.press(screen.getByRole('button', { name: 'Poll' }));
        await fireEvent.changeText(screen.getByPlaceholderText('Choice 1'), 'Tea');
        await fireEvent.changeText(screen.getByPlaceholderText('Choice 2'), 'Coffee');
        await fireEvent.press(screen.getByRole('button', { name: 'Poll length: 1 day' }));
        await fireEvent.press(screen.getByRole('radio', { name: '3 days' }));

        expect(screen.getByText('Ends in 3 days')).toBeTruthy();
        await fireEvent.press(screen.getByText('Post'));
        expect(mockedCreateStatus).toHaveBeenCalledWith(
            expect.objectContaining({ poll: expect.objectContaining({ expires_in: 259200 }) })
        );
    });

    it('inserts a custom emoji shortcode at the cursor', async () => {
        mockedEmojis.mockResolvedValue([
            { shortcode: 'blobcat', url: 'https://x/blobcat.png', static_url: 'https://x/blobcat.png', visible_in_picker: true },
            { shortcode: 'hidden', url: 'https://x/hidden.png', static_url: '', visible_in_picker: false },
        ]);
        await renderCompose();

        await fireEvent.changeText(composer(), 'hello world');
        // The keyboard reports where the cursor is: after "hello"
        await fireEvent(composer(), 'selectionChange', { nativeEvent: { selection: { start: 5, end: 5 } } });
        await fireEvent.press(screen.getByRole('button', { name: 'Custom emoji' }));
        await fireEvent.press(await screen.findByRole('button', { name: ':blobcat:' }));

        expect(screen.queryByRole('button', { name: ':hidden:' })).toBeNull();
        expect(composer().props.value).toBe('hello :blobcat: world');
    });
});
