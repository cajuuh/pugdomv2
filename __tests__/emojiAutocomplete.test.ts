import { completeShortcode, shortcodeAtCursor } from '../components/ComposeModal/emojiAutocomplete';

describe('shortcodeAtCursor', () => {
    const at = (text: string, cursor = text.length) => shortcodeAtCursor(text, cursor);

    it('finds a shortcode being typed at the start of a word', () => {
        expect(at(':neofox_som')).toEqual({ start: 0, query: 'neofox_som' });
        expect(at('hi :ne')).toEqual({ start: 3, query: 'ne' });
        expect(at('line\n:blob')).toEqual({ start: 5, query: 'blob' });
    });

    it('waits for two letters', () => {
        expect(at(':n')).toBeNull();
        expect(at(':')).toBeNull();
    });

    it('leaves times, links and finished emoji alone', () => {
        expect(at('at 10:30')).toBeNull();
        expect(at('https://pug.social/:ab')).toBeNull();
        expect(at(':blobcat: ')).toBeNull();
        expect(at('hi :blob cat')).toBeNull();
    });

    it('only when the cursor ends the word', () => {
        expect(at(':neofox', 4)).toBeNull();
        expect(at(':neo and more', 4)).toEqual({ start: 0, query: 'neo' });
    });
});

describe('completeShortcode', () => {
    it('replaces the half-typed shortcode and adds a space', () => {
        expect(completeShortcode('hi :neo', 3, 7, 'neofox_happy')).toEqual({ text: 'hi :neofox_happy: ', cursor: 18 });
    });

    it('keeps the text after the cursor, without doubling a space', () => {
        expect(completeShortcode(':neo and more', 0, 4, 'neofox')).toEqual({ text: ':neofox: and more', cursor: 8 });
    });
});
