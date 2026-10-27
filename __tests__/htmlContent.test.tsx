import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { StatusHtmlContent } from '../components/TootCard/htmlContent';
import { mockTheme } from '../testUtils/theme';
import { CustomEmoji } from '../services/mastodon/types';

const emoji = (shortcode: string): CustomEmoji => ({
    shortcode,
    url: `https://x/${shortcode}.png`,
    static_url: `https://x/${shortcode}.png`,
    visible_in_picker: true,
});

const renderPost = (content: string, emojis: CustomEmoji[]) =>
    render(<StatusHtmlContent content={content} emojis={emojis} colors={mockTheme.colors} bodyFont={mockTheme.type.body} width={320} />);

const shownEmoji = (tree: unknown) => JSON.stringify(tree).match(/https:\/\/x\/\w+\.png/g) ?? [];

describe('StatusHtmlContent emoji', () => {
    it('shows every emoji of a post made only of emoji', async () => {
        const { toJSON } = await renderPost('<p>:blobcat: :pug: :blobcat:</p>', [emoji('blobcat'), emoji('pug')]);

        expect(shownEmoji(toJSON())).toEqual(['https://x/blobcat.png', 'https://x/pug.png', 'https://x/blobcat.png']);
    });

    it('keeps the text after an emoji', async () => {
        await renderPost('<p>good :pug: morning</p>', [emoji('pug')]);

        expect(screen.getByText(/morning/)).toBeTruthy();
    });
});

describe('StatusHtmlContent text', () => {
    it('can be selected and copied', async () => {
        await renderPost('<p>copy me</p>', []);

        expect(screen.getByText('copy me')).toHaveProp('selectable', true);
    });
});
