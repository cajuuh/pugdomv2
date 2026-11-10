import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils/queryClient';
import apiClient from '../services/api/client';
import Hashtag from '../screens/Hashtag/hashtag';
import { Filter, Status } from '../services/mastodon/types';

jest.mock('../services/api/client', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), delete: jest.fn() } }));
jest.mock('../services/storage', () => ({
    ...jest.requireActual('../services/storage'),
    getCredentials: async () => ({ instanceUrl: 'https://example.social' }),
}));
jest.mock('../services/authContext', () => ({ useAuth: () => ({ user: { id: 'me' } }), useOptionalAuth: () => ({ user: { id: 'me' } }) }));
jest.mock('../services/themeContext', () => ({
    useTheme: () => jest.requireActual('../testUtils/theme').mockTheme,
}));
jest.mock('../components/TootCard/tootCard', () => ({
    TootCard: ({ status }: { status: Status }) => {
        const { Text: MockText } = jest.requireActual('react-native');
        return <MockText>{status.content}</MockText>;
    },
}));

const api = apiClient as unknown as Record<'get' | 'post' | 'delete', jest.Mock>;
const URL = 'https://example.social/api/v2/filters';
const muteFilter: Filter = {
    id: '5',
    title: '#Pugs',
    context: ['home', 'public'],
    expires_at: null,
    filter_action: 'hide',
    keywords: [{ id: 'k', keyword: '#pugs', whole_word: true }],
};
// The post the mute filter matches
const pugPost = { id: 's1', content: 'pug post', filtered: [{ filter: muteFilter, keyword_matches: ['#pugs'], status_matches: null }] };

const serve = (filters: Filter[]) =>
    api.get.mockImplementation(async (url: string) => ({
        data: url === URL ? filters : url.startsWith('/tags/') ? { name: 'Pugs', url: '', following: false, history: [] } : [pugPost],
    }));

const renderHashtag = () =>
    render(
        <QueryClientProvider client={createTestQueryClient()}>
            <Hashtag tag="pugs" onBack={jest.fn()} onStatusPress={jest.fn()} />
        </QueryClientProvider>
    );

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('Muting a hashtag', () => {
    it('creates a hide filter for the tag in Home and public timelines', async () => {
        serve([]);
        api.post.mockResolvedValue({ data: muteFilter });
        await renderHashtag();

        await fireEvent.press(await screen.findByRole('button', { name: 'Mute hashtag' }));

        await waitFor(() =>
            expect(api.post).toHaveBeenCalledWith(URL, {
                title: '#Pugs',
                context: ['home', 'public'],
                filter_action: 'hide',
                expires_in: '',
                keywords_attributes: [{ keyword: '#Pugs', whole_word: true }],
            })
        );
    });

    it("still shows the tag's posts on its own screen, and unmutes by deleting the filter", async () => {
        serve([muteFilter]);
        api.delete.mockResolvedValue({ data: {} });
        await renderHashtag();

        expect(await screen.findByText('pug post')).toBeTruthy();
        await fireEvent.press(await screen.findByRole('button', { name: 'Muted' }));

        await waitFor(() => expect(api.delete).toHaveBeenCalledWith(`${URL}/5`));
    });
});
