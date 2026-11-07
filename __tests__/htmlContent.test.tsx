import React from 'react';
import { Platform, Share } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useOptionalMediaViewer } from '../components/MediaViewer/mediaViewer';
import { StatusHtmlContent } from '../components/TootCard/htmlContent';
import { mockTheme } from '../testUtils/theme';
import { CustomEmoji } from '../services/mastodon/types';
import { renderTextWithEmojis } from '../services/emojiHelper';
import { HUGE_POST, LONG_POST, breakLongRuns, postSize, splitTrailingHashtags } from '../services/htmlText';

jest.mock('../components/MediaViewer/mediaViewer', () => ({ useOptionalMediaViewer: jest.fn(() => undefined) }));

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

describe('holding a link', () => {
    it('offers it to copy or share, without opening it', async () => {
        const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
        const onPressLink = jest.fn();
        await render(
            <StatusHtmlContent content='<p><a href="https://pug.example/a">a link</a></p>' emojis={[]} colors={mockTheme.colors} bodyFont={mockTheme.type.body} width={320} onPressLink={onPressLink} />
        );

        await fireEvent(screen.getByText('a link'), 'longPress');
        expect(share).toHaveBeenCalledWith(expect.objectContaining(Platform.OS === 'ios' ? { url: 'https://pug.example/a' } : { message: 'https://pug.example/a' }));
        expect(onPressLink).not.toHaveBeenCalled();

        await fireEvent.press(screen.getByText('a link'));
        expect(onPressLink).toHaveBeenCalledWith('https://pug.example/a');
        share.mockRestore();
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

describe('trailing hashtags', () => {
    const tag = (name: string) => `<a href="https://x/tags/${name}" class="mention hashtag" rel="tag">#<span>${name}</span></a>`;

    it('takes a last paragraph of only hashtags out of the text', () => {
        expect(splitTrailingHashtags(`<p>hello</p><p>${tag('pug')} ${tag('dog')}</p>`)).toEqual({ html: '<p>hello</p>', tags: ['pug', 'dog'] });
    });

    it('takes a last line of only hashtags after a line break', () => {
        expect(splitTrailingHashtags(`<p>hello<br />${tag('pug')}<br>${tag('dog')}</p>`)).toEqual({ html: '<p>hello</p>', tags: ['pug', 'dog'] });
    });

    it('leaves hashtags in a sentence, and text after them', () => {
        const sentence = `<p>hello ${tag('pug')}</p>`;
        const textAfter = `<p>${tag('pug')}</p><p>bye</p>`;
        expect(splitTrailingHashtags(sentence)).toEqual({ html: sentence, tags: [] });
        expect(splitTrailingHashtags(textAfter)).toEqual({ html: textAfter, tags: [] });
    });

    it('leaves a post that is nothing but hashtags as it is', () => {
        const only = `<p>${tag('pug')} ${tag('dog')}</p>`;
        expect(splitTrailingHashtags(only)).toEqual({ html: only, tags: [] });
    });

    it('takes accented hashtags, and handles a post with no paragraphs', () => {
        expect(splitTrailingHashtags(`<p>oi</p><p>${tag('São_Paulo')}</p>`).tags).toEqual(['São_Paulo']);
        expect(splitTrailingHashtags('')).toEqual({ html: '', tags: [] });
    });
});

describe('an emoji in a line of text', () => {
    it('sits lowered in post text, by a share of its size', async () => {
        const { toJSON } = await renderPost('<p>hi :pug:</p>', [emoji('pug')]);
        expect(JSON.stringify(toJSON())).toContain('"translateY":3.2');
    });

    it('sits lowered in names too', async () => {
        const { toJSON } = await render(renderTextWithEmojis('Pug :pug:', [emoji('pug')], null, 15)!);
        expect(JSON.stringify(toJSON())).toContain('"translateY":3');
    });
});

describe('tapping an emoji', () => {
    it('shows it bigger, in the media viewer', async () => {
        const openMedia = jest.fn();
        (useOptionalMediaViewer as jest.Mock).mockReturnValueOnce({ openMedia }).mockReturnValue({ openMedia });
        await renderPost('<p>hi :pug:</p>', [emoji('pug')]);

        await fireEvent.press(screen.getByRole('imagebutton', { name: ':pug:' }));

        expect(openMedia).toHaveBeenCalledWith([expect.objectContaining({ type: 'image', url: 'https://x/pug.png', description: ':pug:' })], 0);
        (useOptionalMediaViewer as jest.Mock).mockReturnValue(undefined);
    });

    it('still draws it outside the viewer', async () => {
        const { toJSON } = await renderPost('<p>:pug:</p>', [emoji('pug')]);
        expect(shownEmoji(toJSON())).toEqual(['https://x/pug.png']);
    });
});
