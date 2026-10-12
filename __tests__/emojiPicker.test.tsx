import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../testUtils/queryClient';
import { EmojiPicker, groupByCategory, searchEmojis, UNCATEGORIZED } from '../components/ComposeModal/emojiPicker';
import { fetchCustomEmojis } from '../services/mastodon/customEmojis';
import { CustomEmoji } from '../services/mastodon/types';

jest.mock('../services/themeContext', () => ({
    useTheme: () => jest.requireActual('../testUtils/theme').mockTheme,
}));
jest.mock('../services/mastodon/customEmojis', () => ({ fetchCustomEmojis: jest.fn() }));
// The keyboard, as the sheet sees it
let mockKeyboard = { visible: false, inset: 0 };
jest.mock('../hooks/useKeyboard', () => ({ useKeyboard: () => mockKeyboard }));

const mockedFetch = fetchCustomEmojis as jest.MockedFunction<typeof fetchCustomEmojis>;

const emoji = (shortcode: string, category?: string | null, visible = true): CustomEmoji => ({
    shortcode,
    url: `https://x/${shortcode}.png`,
    static_url: `https://x/${shortcode}.png`,
    visible_in_picker: visible,
    category,
});

const renderPicker = (onPick = jest.fn()) =>
    render(
        <QueryClientProvider client={createTestQueryClient()}>
            <EmojiPicker visible onPick={onPick} onClose={jest.fn()} />
        </QueryClientProvider>
    );

describe('groupByCategory', () => {
    it('sorts categories A–Z and puts uncategorized emoji last under Other', () => {
        const groups = groupByCategory([emoji('blobcat', 'Blobs'), emoji('pug'), emoji('ablobwave', 'Blobs'), emoji('flag_br', 'Flags'), emoji('x', '  ')]);

        expect(groups.map(group => group.category)).toEqual(['Blobs', 'Flags', UNCATEGORIZED]);
        expect(groups[0].emojis.map(e => e.shortcode)).toEqual(['blobcat', 'ablobwave']);
        expect(groups[2].emojis.map(e => e.shortcode)).toEqual(['pug', 'x']);
    });
});

describe('EmojiPicker', () => {
    beforeEach(() => jest.clearAllMocks());

    it('shows every category under its own header, with a chip for each', async () => {
        mockedFetch.mockResolvedValue([emoji('blobcat', 'Blobs'), emoji('flag_br', 'Flags'), emoji('pug'), emoji('hidden', 'Blobs', false)]);
        await renderPicker();

        expect(await screen.findByRole('button', { name: ':blobcat:' })).toBeTruthy();
        expect(screen.getByRole('header', { name: 'Blobs' })).toBeTruthy();
        expect(screen.getByRole('header', { name: 'Flags' })).toBeTruthy();
        expect(screen.getByRole('header', { name: 'Other' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'All' })).toBeSelected();
        expect(screen.queryByRole('button', { name: ':hidden:' })).toBeNull();
    });

    it('keeps a server category literally named "Other" apart from the uncategorized group', async () => {
        mockedFetch.mockResolvedValue([emoji('blobcat', 'Other'), emoji('pug')]);
        await renderPicker();
        await screen.findByRole('button', { name: ':blobcat:' });

        expect(screen.getAllByRole('header', { name: 'Other' })).toHaveLength(2);
        expect(screen.getAllByRole('button', { name: 'Other' })).toHaveLength(2);
    });

    it('shows only one category when its chip is picked', async () => {
        mockedFetch.mockResolvedValue([emoji('blobcat', 'Blobs'), emoji('flag_br', 'Flags'), emoji('pug')]);
        await renderPicker();
        await screen.findByRole('button', { name: ':blobcat:' });

        await fireEvent.press(screen.getByRole('button', { name: 'Flags' }));

        expect(screen.getByRole('button', { name: 'Flags' })).toBeSelected();
        expect(screen.getByRole('button', { name: ':flag_br:' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: ':blobcat:' })).toBeNull();
        expect(screen.queryByRole('button', { name: ':pug:' })).toBeNull();
    });

    it('keeps the plain grid for servers without categories', async () => {
        const onPick = jest.fn();
        mockedFetch.mockResolvedValue([emoji('pug'), emoji('blobcat')]);
        await renderPicker(onPick);

        await fireEvent.press(await screen.findByRole('button', { name: ':pug:' }));

        expect(onPick).toHaveBeenCalledWith('pug');
        expect(screen.queryByRole('button', { name: 'All' })).toBeNull();
        expect(screen.queryByRole('header', { name: 'Other' })).toBeNull();
    });
});

describe('searchEmojis', () => {
    it('finds shortcodes containing the query, those starting with it first, ignoring colons and case', () => {
        const list = [emoji('happy_blobcat'), emoji('blobcat'), emoji('pug'), emoji('BlobFox')];
        expect(searchEmojis(list, ':BLOB').map(e => e.shortcode)).toEqual(['blobcat', 'BlobFox', 'happy_blobcat']);
        expect(searchEmojis(list, '  ')).toEqual([]);
    });
});

describe('EmojiPicker search', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockKeyboard = { visible: false, inset: 0 };
    });

    it('shows matches from every category in one grid, and the categories again once cleared', async () => {
        const onPick = jest.fn();
        mockedFetch.mockResolvedValue([emoji('blobcat', 'Blobs'), emoji('flag_br', 'Flags'), emoji('cat_pug')]);
        await renderPicker(onPick);
        await screen.findByRole('button', { name: ':blobcat:' });

        await fireEvent.changeText(screen.getByLabelText('Search emoji'), 'cat');

        expect(screen.getByRole('button', { name: ':blobcat:' })).toBeTruthy();
        expect(screen.getByRole('button', { name: ':cat_pug:' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: ':flag_br:' })).toBeNull();
        // No chips or headers while searching
        expect(screen.queryByRole('button', { name: 'All' })).toBeNull();
        expect(screen.queryByRole('header', { name: 'Blobs' })).toBeNull();

        await fireEvent.press(screen.getByRole('button', { name: ':cat_pug:' }));
        expect(onPick).toHaveBeenCalledWith('cat_pug');

        await fireEvent.changeText(screen.getByLabelText('Search emoji'), '');
        expect(screen.getByRole('header', { name: 'Flags' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'All' })).toBeTruthy();
    });

    it('says when nothing matches', async () => {
        mockedFetch.mockResolvedValue([emoji('blobcat', 'Blobs'), emoji('pug')]);
        await renderPicker();
        await screen.findByRole('button', { name: ':blobcat:' });

        await fireEvent.changeText(screen.getByLabelText('Search emoji'), 'zebra');

        expect(screen.getByText('No emoji match “zebra”')).toBeTruthy();
    });

    it('rides above the keyboard', async () => {
        mockKeyboard = { visible: true, inset: 300 };
        mockedFetch.mockResolvedValue([emoji('pug')]);
        await renderPicker();
        await screen.findByRole('button', { name: ':pug:' });

        expect(StyleSheet.flatten(screen.getByTestId('bottom-sheet').props.style).paddingBottom).toBe(308);
    });
});
