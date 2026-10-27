import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createTestQueryClient } from '../testUtils/queryClient';
import ComposeModal from '../components/ComposeModal/composeModal';
import Drafts from '../screens/Drafts/drafts';
import { Draft, DraftContent, deleteDraft, getDrafts, saveDraft } from '../services/drafts';
import { createStatus } from '../services/mastodon/statuses';
import { DEFAULT_INSTANCE_CONFIGURATION, fetchInstanceConfiguration } from '../services/mastodon/instance';
import { dialog, DialogButton } from '../services/dialog';
import { Account, Status } from '../services/mastodon/types';

const me: Account = { id: '1', username: 'me', acct: 'me', display_name: 'Me', avatar: '', emojis: [], source: { language: 'pt' } };

jest.mock('../services/authContext', () => ({ useAuth: () => ({ user: me }), useOptionalAuth: () => ({ user: me }) }));
jest.mock('../services/themeContext', () => ({ useTheme: () => jest.requireActual('../testUtils/theme').mockTheme }));
jest.mock('../services/mastodon/statuses', () => ({ createStatus: jest.fn() }));
jest.mock('../services/mastodon/customEmojis', () => ({ fetchCustomEmojis: jest.fn(async () => []) }));
jest.mock('../services/mastodon/instance', () => ({
    ...jest.requireActual('../services/mastodon/instance'),
    fetchInstanceConfiguration: jest.fn(),
}));
const mockOpenCompose = jest.fn();
jest.mock('../services/composeContext', () => ({ useCompose: () => ({ openCompose: mockOpenCompose }) }));

// Files as paths: copies and deleted folders are recorded
const mockCopies: [string, string][] = [];
const mockDeleted: string[] = [];
jest.mock('expo-file-system', () => {
    const join = (parts: unknown[]) => parts.map(part => (typeof part === 'string' ? part : (part as { uri: string }).uri)).join('/');
    class Directory {
        uri: string;
        exists = true;
        constructor(...parts: unknown[]) {
            this.uri = join(parts);
        }
        create() {}
        delete() {
            mockDeleted.push(this.uri);
        }
    }
    class File {
        uri: string;
        constructor(...parts: unknown[]) {
            this.uri = join(parts);
        }
        async copy(to: { uri: string }) {
            mockCopies.push([this.uri, to.uri]);
        }
    }
    return { Paths: { document: { uri: 'file:///docs' } }, Directory, File };
});

const content = (extra: Partial<DraftContent> = {}): DraftContent => ({
    text: 'Half a thought',
    spoilerText: '',
    sensitive: false,
    visibility: 'public',
    language: 'pt',
    quotePolicy: 'public',
    scheduledAt: null,
    poll: null,
    replyTo: null,
    quote: null,
    media: [],
    ...extra,
});

// The dialog's buttons, pressed by name
const pressDialogButton = (alert: jest.SpyInstance, text: string) => {
    const buttons: DialogButton[] = alert.mock.calls[alert.mock.calls.length - 1][2];
    buttons.find(button => button.text === text)!.onPress!();
};

beforeEach(async () => {
    jest.clearAllMocks();
    mockCopies.length = 0;
    mockDeleted.length = 0;
    await AsyncStorage.clear();
    (createStatus as jest.Mock).mockResolvedValue({} as Status);
    (fetchInstanceConfiguration as jest.Mock).mockResolvedValue(DEFAULT_INSTANCE_CONFIGURATION);
});

describe('draft storage', () => {
    it('copies picked media next to the draft and keeps the newest first', async () => {
        const photo = { uri: 'file:///cache/picked.jpg', width: 10, height: 10 };
        const first = await saveDraft('1', content({ media: [{ image: photo, description: 'A pug' }] }));
        await saveDraft('1', content({ text: 'Later' }));

        expect(mockCopies).toEqual([['file:///cache/picked.jpg', `file:///docs/drafts/${first.id}/0.jpg`]]);
        const drafts = await getDrafts('1');
        expect(drafts.map(draft => draft.text)).toEqual(['Later', 'Half a thought']);
        expect(drafts[1].media[0]).toEqual({ image: { ...photo, uri: `file:///docs/drafts/${first.id}/0.jpg` }, description: 'A pug' });
        expect(await getDrafts('2')).toEqual([]);
    });

    it('replaces a reopened draft, and deletes one with its media', async () => {
        const first = await saveDraft('1', content());
        const second = await saveDraft('1', content({ text: 'Better' }), first.id);

        expect((await getDrafts('1')).map(draft => draft.id)).toEqual([second.id]);
        expect(mockDeleted).toEqual([`file:///docs/drafts/${first.id}`]);

        await deleteDraft('1', second.id);
        expect(await getDrafts('1')).toEqual([]);
    });
});

describe('closing compose', () => {
    const renderCompose = async (props: Partial<React.ComponentProps<typeof ComposeModal>> = {}) => {
        const closeCompose = jest.fn();
        await render(
            <QueryClientProvider client={createTestQueryClient()}>
                <ComposeModal isOpen replyToStatus={null} closeCompose={closeCompose} {...props} />
            </QueryClientProvider>
        );
        return closeCompose;
    };

    it('closes an empty post without asking', async () => {
        const alert = jest.spyOn(dialog, 'alert');
        const closeCompose = await renderCompose();

        await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

        expect(alert).not.toHaveBeenCalled();
        expect(closeCompose).toHaveBeenCalled();
    });

    it('asks from Cancel, and Save draft keeps the post on the phone', async () => {
        const alert = jest.spyOn(dialog, 'alert');
        const toast = jest.spyOn(dialog, 'toast');
        const closeCompose = await renderCompose();
        await fireEvent.changeText(screen.getByLabelText('Post text'), 'Half a thought');

        await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
        expect(alert).toHaveBeenCalledWith('Save as a draft?', expect.any(String), expect.any(Array), expect.anything());
        expect(closeCompose).not.toHaveBeenCalled();

        pressDialogButton(alert, 'Save draft');

        await waitFor(() => expect(closeCompose).toHaveBeenCalled());
        expect(toast).toHaveBeenCalledWith('Saved to Drafts');
        expect((await getDrafts('1')).map(draft => draft.text)).toEqual(['Half a thought']);
    });

    it('reopens a draft as it was left, and drops it once posted', async () => {
        const draft = await saveDraft('1', content({ text: 'Picked up again', spoilerText: 'Spoilers', sensitive: true }));
        const closeCompose = await renderCompose({ draft });

        expect(screen.getByLabelText('Post text').props.value).toBe('Picked up again');
        await fireEvent.press(screen.getByRole('button', { name: 'Post' }));

        await waitFor(() => expect(closeCompose).toHaveBeenCalled());
        expect(createStatus).toHaveBeenCalledWith(expect.objectContaining({ status: 'Picked up again', spoiler_text: 'Spoilers' }));
        await waitFor(async () => expect(await getDrafts('1')).toEqual([]));
    });
});

describe('Drafts screen', () => {
    it('lists drafts and continues one in compose', async () => {
        const draft: Draft = await saveDraft('1', content({ text: 'Unfinished' }));
        await render(
            <QueryClientProvider client={createTestQueryClient()}>
                <Drafts onBack={jest.fn()} />
            </QueryClientProvider>
        );

        expect(await screen.findByText('Unfinished')).toBeTruthy();
        await fireEvent.press(screen.getAllByRole('button', { name: 'Continue' })[0]);

        expect(mockOpenCompose).toHaveBeenCalledWith(expect.objectContaining({ draft: expect.objectContaining({ id: draft.id }) }));
    });
});
