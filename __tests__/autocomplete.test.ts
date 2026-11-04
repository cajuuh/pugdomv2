import { completeToken, rankMentions, tokenAtCursor } from '../components/ComposeModal/autocomplete';

describe('tokenAtCursor', () => {
    const at = (text: string, cursor = text.length) => tokenAtCursor(text, cursor);

    it('finds a custom emoji being typed at the start of a word', () => {
        expect(at(':neofox_som')).toEqual({ trigger: ':', start: 0, query: 'neofox_som' });
        expect(at('hi :ne')).toEqual({ trigger: ':', start: 3, query: 'ne' });
        expect(at('line\n:blob')).toEqual({ trigger: ':', start: 5, query: 'blob' });
    });

    it('waits for two letters of an emoji', () => {
        expect(at(':n')).toBeNull();
        expect(at(':')).toBeNull();
    });

    it('finds a mention from its first letter, with or without a server', () => {
        expect(at('@a')).toEqual({ trigger: '@', start: 0, query: 'a' });
        expect(at('oi @ana@pug.so')).toEqual({ trigger: '@', start: 3, query: 'ana@pug.so' });
        expect(at('@')).toBeNull();
    });

    it('leaves times, links, e-mail addresses and finished ones alone', () => {
        expect(at('at 10:30')).toBeNull();
        expect(at('https://pug.social/:ab')).toBeNull();
        expect(at('mail ana@pug.social')).toBeNull();
        expect(at(':blobcat: ')).toBeNull();
        expect(at('@ana ')).toBeNull();
    });

    it('only when the cursor ends the word', () => {
        expect(at(':neofox', 4)).toBeNull();
        expect(at('@anabela', 3)).toBeNull();
        expect(at(':neo and more', 4)).toEqual({ trigger: ':', start: 0, query: 'neo' });
    });
});

describe('completeToken', () => {
    it('replaces what was half-typed and adds a space', () => {
        expect(completeToken('hi :neo', 3, 7, ':neofox_happy:')).toEqual({ text: 'hi :neofox_happy: ', cursor: 18 });
        expect(completeToken('oi @an', 3, 6, '@ana@pug.social')).toEqual({ text: 'oi @ana@pug.social ', cursor: 19 });
    });

    it('keeps the text after the cursor, without doubling a space', () => {
        expect(completeToken(':neo and more', 0, 4, ':neofox:')).toEqual({ text: ':neofox: and more', cursor: 8 });
    });
});

describe('rankMentions', () => {
    const person = (id: string, acct: string) => ({ id, acct });
    const followed = person('1', 'isadora@far.social');
    const local = person('2', 'isa');
    const remote = person('3', 'isabel@far.social');

    it('puts who you follow first, then your server, then everyone else, once each', () => {
        expect(rankMentions([followed], [remote, followed, local])).toEqual([followed, local, remote]);
    });

    it('keeps the server order inside each group', () => {
        const other = person('4', 'isaac');
        expect(rankMentions([], [other, remote, local])).toEqual([other, local, remote]);
    });

    it('leaves you out, since your server counts you among those you follow', () => {
        const me = person('9', 'isa_me');
        expect(rankMentions([me, followed], [me, local], '9')).toEqual([followed, local]);
    });
});
