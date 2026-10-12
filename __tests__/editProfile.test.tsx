import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils/queryClient';
import apiClient from '../services/api/client';
import EditProfile from '../screens/EditProfile/editProfile';
import { updateProfile } from '../services/mastodon/accounts';
import { Account } from '../services/mastodon/types';

jest.mock('../services/api/client', () => ({ __esModule: true, default: { patch: jest.fn() } }));
const me: Account = {
    id: '7',
    username: 'pug',
    acct: 'pug',
    display_name: 'Pug',
    avatar: '',
    emojis: [],
    locked: false,
    bot: false,
    discoverable: true,
    source: { note: 'I like naps', fields: [{ name: 'Site', value: 'pug.example' }] },
};
const mockUpdateUser = jest.fn();
jest.mock('../services/authContext', () => ({ useAuth: () => ({ user: me, updateUser: mockUpdateUser }) }));
jest.mock('../services/themeContext', () => ({
    useTheme: () => jest.requireActual('../testUtils/theme').mockTheme,
}));

const api = apiClient as unknown as { patch: jest.Mock };
// What was appended, by name (the tests run on Node's FormData)
const partsOf = (form: FormData) => Object.fromEntries(form.entries());

beforeEach(() => jest.clearAllMocks());

describe('updateProfile', () => {
    it('sends the profile as multipart, clearing emptied field slots', async () => {
        api.patch.mockResolvedValue({ data: me });

        await updateProfile(
            { displayName: 'Pug', note: 'naps', fields: [{ name: 'Site', value: 'pug.example' }], locked: true, bot: false, discoverable: true },
            2
        );

        const [url, form, config] = api.patch.mock.calls[0];
        expect(url).toBe('/accounts/update_credentials');
        expect(config.headers['Content-Type']).toBe('multipart/form-data');
        expect(partsOf(form)).toMatchObject({
            display_name: 'Pug',
            note: 'naps',
            locked: 'true',
            bot: 'false',
            discoverable: 'true',
            'fields_attributes[0][name]': 'Site',
            'fields_attributes[0][value]': 'pug.example',
            'fields_attributes[1][name]': '',
            'fields_attributes[1][value]': '',
        });
    });
});

describe('EditProfile', () => {
    const renderEditor = (onBack = jest.fn()) =>
        render(
            <QueryClientProvider client={createTestQueryClient()}>
                <EditProfile onBack={onBack} />
            </QueryClientProvider>
        );

    it("starts from the account's profile as typed", async () => {
        await renderEditor();

        expect(screen.getByLabelText('Display name').props.value).toBe('Pug');
        expect(screen.getByLabelText('Bio').props.value).toBe('I like naps');
        expect(screen.getByLabelText('Field 1 label').props.value).toBe('Site');
        expect(screen.getByLabelText('Field 1 content').props.value).toBe('pug.example');
        // Nothing to save until something changes
        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    });

    it('saves the changes, updates the signed-in account and goes back', async () => {
        const saved = { ...me, display_name: 'Pug the Great' };
        api.patch.mockResolvedValue({ data: saved });
        const onBack = jest.fn();
        await renderEditor(onBack);

        await fireEvent.changeText(screen.getByLabelText('Display name'), 'Pug the Great');
        await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(onBack).toHaveBeenCalled());
        expect(partsOf(api.patch.mock.calls[0][1])).toMatchObject({ display_name: 'Pug the Great', note: 'I like naps' });
        expect(mockUpdateUser).toHaveBeenCalledWith(saved);
    });

    it('stays, with the reason, when the server refuses', async () => {
        api.patch.mockRejectedValue({ response: { data: { error: 'Display name is too long' } } });
        const onBack = jest.fn();
        await renderEditor(onBack);

        await fireEvent.changeText(screen.getByLabelText('Bio'), 'Naps all day');
        await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(api.patch).toHaveBeenCalled());
        expect(onBack).not.toHaveBeenCalled();
        expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    it('asks before throwing away unsaved changes', async () => {
        const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
        const onBack = jest.fn();
        await renderEditor(onBack);

        await fireEvent.press(screen.getByRole('button', { name: 'Go back' }));
        expect(onBack).toHaveBeenCalledTimes(1);

        await fireEvent(screen.getByLabelText('Approve followers'), 'valueChange', true);
        await fireEvent.press(screen.getByRole('button', { name: 'Go back' }));
        expect(onBack).toHaveBeenCalledTimes(1);
        expect(alert).toHaveBeenCalledWith('Discard your changes?', expect.any(String), expect.any(Array));
    });
});
