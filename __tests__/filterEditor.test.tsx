import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils/queryClient';
import apiClient from '../services/api/client';
import { FilterEditor, FilterList } from '../screens/Filters/filters';
import { Filter } from '../services/mastodon/types';

jest.mock('../services/api/client', () => ({
    __esModule: true,
    default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));
jest.mock('../services/storage', () => ({
    ...jest.requireActual('../services/storage'),
    getCredentials: async () => ({ instanceUrl: 'https://example.social' }),
}));
jest.mock('../services/themeContext', () => ({
    useTheme: () => jest.requireActual('../testUtils/theme').mockTheme,
}));

const api = apiClient as unknown as Record<'get' | 'post' | 'put' | 'delete', jest.Mock>;
const URL = 'https://example.social/api/v2/filters';
const spoilers: Filter = {
    id: '9',
    title: 'Spoilers',
    context: ['home', 'public'],
    expires_at: null,
    filter_action: 'warn',
    keywords: [{ id: 'k1', keyword: 'finale', whole_word: true }, { id: 'k2', keyword: 'ending', whole_word: false }],
};

const withQuery = (children: React.ReactNode) => <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>;

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    api.get.mockResolvedValue({ data: [spoilers] });
    api.post.mockResolvedValue({ data: spoilers });
    api.put.mockResolvedValue({ data: spoilers });
});

describe('Filters', () => {
    it('lists your filters and opens one', async () => {
        const onEdit = jest.fn();
        await render(withQuery(<FilterList onBack={jest.fn()} onEdit={onEdit} />));
        await fireEvent.press(await screen.findByText('Spoilers'));
        expect(onEdit).toHaveBeenCalledWith('9');
        expect(screen.getByText('Cover with a warning · 2 words · Home and lists, Public timelines')).toBeTruthy();
    });

    it('creates a filter with its words, places and action', async () => {
        const onBack = jest.fn();
        await render(withQuery(<FilterEditor onBack={onBack} />));
        await fireEvent.changeText(screen.getByLabelText('Name'), 'Politics');
        await fireEvent.changeText(screen.getByLabelText('A word or phrase'), 'election');
        await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
        await fireEvent(screen.getByLabelText('Notifications'), 'valueChange', true);
        await fireEvent.press(screen.getByRole('button', { name: 'Create filter' }));

        await waitFor(() => expect(onBack).toHaveBeenCalled());
        expect(api.post).toHaveBeenCalledWith(URL, {
            title: 'Politics',
            context: ['home', 'notifications', 'public'],
            filter_action: 'warn',
            expires_in: '',
            keywords_attributes: [{ id: undefined, keyword: 'election', whole_word: true }],
        });
    });

    it('edits a filter: keeps, removes and adds words, and keeps its expiry', async () => {
        const onBack = jest.fn();
        await render(withQuery(<FilterEditor filterId="9" onBack={onBack} />));
        await screen.findByDisplayValue('Spoilers');
        await fireEvent.press(screen.getByRole('button', { name: 'Remove ending' }));
        await fireEvent.changeText(screen.getByLabelText('A word or phrase'), 'season 3');
        await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(onBack).toHaveBeenCalled());
        expect(api.put).toHaveBeenCalledWith(`${URL}/9`, {
            title: 'Spoilers',
            context: ['home', 'public'],
            filter_action: 'warn',
            keywords_attributes: [
                { id: 'k1', keyword: 'finale', whole_word: true },
                { id: undefined, keyword: 'season 3', whole_word: true },
                { id: 'k2', _destroy: true },
            ],
        });
    });
});
