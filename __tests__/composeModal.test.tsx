import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils/queryClient';
import ComposeModal from '../components/ComposeModal/composeModal';
import { createStatus } from '../services/mastodon/statuses';
import { fetchInstanceConfiguration } from '../services/mastodon/instance';
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

jest.mock('../services/mastodon/instance', () => ({
    ...jest.requireActual('../services/mastodon/instance'),
    fetchInstanceConfiguration: jest.fn(),
}));

const mockedCreateStatus = createStatus as jest.MockedFunction<typeof createStatus>;
const mockedInstance = fetchInstanceConfiguration as jest.MockedFunction<typeof fetchInstanceConfiguration>;

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
        mockedInstance.mockResolvedValue({ maxCharacters: 500, maxPollOptions: 4, maxCharactersPerPollOption: 50 });
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
        mockedInstance.mockResolvedValue({ maxCharacters: 1000, maxPollOptions: 4, maxCharactersPerPollOption: 50 });
        await renderCompose();
        await screen.findByText('1000');

        await fireEvent.changeText(composer(), `hi https://example.social/${'a'.repeat(200)}`);
        expect(screen.getByText(String(1000 - 3 - 23))).toBeTruthy();
    });

    it('does not publish a poll with fewer than two choices', async () => {
        await renderCompose();

        await fireEvent.changeText(composer(), 'Which one?');
        await fireEvent.press(screen.getByTestId('compose-poll-toggle'));
        await fireEvent.changeText(screen.getByPlaceholderText('Choice 1'), 'Tea');

        expect(screen.getByText('Add at least 2 choices')).toBeTruthy();
        await fireEvent.press(screen.getByText('Post'));
        expect(mockedCreateStatus).not.toHaveBeenCalled();
    });

    it('rejects duplicate poll choices and publishes once they differ', async () => {
        await renderCompose();

        await fireEvent.changeText(composer(), 'Which one?');
        await fireEvent.press(screen.getByTestId('compose-poll-toggle'));
        await fireEvent.changeText(screen.getByPlaceholderText('Choice 1'), 'Tea');
        await fireEvent.changeText(screen.getByPlaceholderText('Choice 2'), ' Tea ');
        expect(screen.getByText('Choices must be different')).toBeTruthy();

        await fireEvent.changeText(screen.getByPlaceholderText('Choice 2'), 'Coffee');
        await fireEvent.press(screen.getByText('Post'));
        expect(mockedCreateStatus).toHaveBeenCalledWith(
            expect.objectContaining({ poll: expect.objectContaining({ options: ['Tea', 'Coffee'] }) })
        );
    });
});
