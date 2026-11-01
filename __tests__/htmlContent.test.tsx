import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { StatusHtmlContent } from '../components/TootCard/htmlContent';
import { mockTheme } from '../testUtils/theme';
import { CustomEmoji } from '../services/mastodon/types';
import { HUGE_POST, LONG_POST, breakLongRuns, postSize } from '../services/htmlText';

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

describe('long posts', () => {
    it('sizes posts by length and by line count', () => {
        expect(postSize('a'.repeat(LONG_POST))).toBe('normal');
        expect(postSize('a'.repeat(LONG_POST + 1))).toBe('long');
        expect(postSize('line\n'.repeat(15))).toBe('long');
        expect(postSize('a'.repeat(HUGE_POST + 1))).toBe('huge');
    });

    it('breaks runs with no spaces every 40 characters, outside tags, keeping entities and emoji whole', () => {
        const run = 'A'.repeat(100);
        expect(breakLongRuns(`<p>${run}</p>`)).toBe(`<p>${'A'.repeat(40)}\u200B${'A'.repeat(40)}\u200B${'A'.repeat(20)}</p>`);
        expect(breakLongRuns(`<a href="https://x/${run}">short</a>`)).toBe(`<a href="https://x/${run}">short</a>`);
        expect(breakLongRuns(`<p>${'&amp;'.repeat(50)}</p>`).replace(/\u200B/g, '')).toBe(`<p>${'&amp;'.repeat(50)}</p>`);
        expect(breakLongRuns(`<p>${'&amp;'.repeat(50)}</p>`)).not.toMatch(/&[^;]*\u200B/);
        expect(breakLongRuns(`<p>${'🐶'.repeat(50)}</p>`)).not.toMatch(/[\uD800-\uDBFF]\u200B/);
        expect(breakLongRuns('<p>normal words stay as they are</p>')).toBe('<p>normal words stay as they are</p>');
    });

    it('lets a long run of characters wrap in the rendered post', async () => {
        await renderPost(`<p>${'A'.repeat(80)}</p>`, []);

        expect(screen.getByText(`${'A'.repeat(40)}\u200B${'A'.repeat(40)}`)).toBeTruthy();
    });
});
