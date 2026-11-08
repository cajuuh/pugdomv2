import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils/queryClient';
import apiClient from '../services/api/client';
import AccountNote from '../screens/AccountNote/accountNote';
import { DialogHost } from '../components/Dialog/dialogHost';
import { Account, Relationship } from '../services/mastodon/types';

jest.mock('../services/api/client', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
jest.mock('../services/themeContext', () => ({ useTheme: () => jest.requireActual('../testUtils/theme').mockTheme }));

const api = apiClient as unknown as Record<'post', jest.Mock>;
const ana: Account = { id: 'ana', username: 'ana', acct: 'ana@art.social', display_name: 'Ana', avatar: '', emojis: [] };
const relationship = (note: string): Relationship => ({ id: 'ana', following: true, requested: false, followed_by: false, note });

const renderNote = async (note: string, onBack = jest.fn()) => {
    const queryClient = createTestQueryClient();
    // The profile's relationship, which the saved note replaces
    queryClient.setQueryData(['relationships', ['ana']], [relationship(note)]);
    await render(
        <QueryClientProvider client={queryClient}>
            <AccountNote account={ana} note={note} onBack={onBack} />
            <DialogHost />
        </QueryClientProvider>
    );
    return { queryClient, onBack };
};

beforeEach(() => jest.clearAllMocks());

describe('Your note on someone', () => {
    it('saves it on your server and updates their profile', async () => {
        api.post.mockResolvedValue({ data: relationship('met at the pug meetup') });
        const { queryClient, onBack } = await renderNote('');

        expect(screen.getByRole('header', { name: 'Note on @ana@art.social' })).toBeTruthy();
        // Nothing to save until it changes
        expect(screen.getByRole('button', { name: 'Save note' })).toBeDisabled();
        await fireEvent.changeText(screen.getByLabelText('Your note'), '  met at the pug meetup ');
        await fireEvent.press(screen.getByRole('button', { name: 'Save note' }));

        await waitFor(() => expect(onBack).toHaveBeenCalled());
        expect(api.post).toHaveBeenCalledWith('/accounts/ana/note', { comment: 'met at the pug meetup' });
        expect(queryClient.getQueryData<Relationship[]>(['relationships', ['ana']])?.[0].note).toBe('met at the pug meetup');
        expect(await screen.findByText('Note saved')).toBeTruthy();
    });

    it('removes it when saved empty', async () => {
        api.post.mockResolvedValue({ data: relationship('') });
        const { onBack } = await renderNote('old note');

        await fireEvent.changeText(screen.getByLabelText('Your note'), '');
        await fireEvent.press(screen.getByRole('button', { name: 'Save note' }));

        await waitFor(() => expect(onBack).toHaveBeenCalled());
        expect(api.post).toHaveBeenCalledWith('/accounts/ana/note', { comment: '' });
        expect(await screen.findByText('Note removed')).toBeTruthy();
    });

    it('stays open and says so when saving fails', async () => {
        api.post.mockRejectedValue(new Error('500'));
        const { onBack } = await renderNote('');

        await fireEvent.changeText(screen.getByLabelText('Your note'), 'pug person');
        await fireEvent.press(screen.getByRole('button', { name: 'Save note' }));

        expect(await screen.findByText("Couldn't save the note")).toBeTruthy();
        expect(onBack).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Save note' })).toBeEnabled();
    });
});
