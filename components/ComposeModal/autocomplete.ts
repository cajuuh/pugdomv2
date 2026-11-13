// What can be completed while typing: a custom emoji (":" and at least two letters) or a mention ("@" and at least
// one letter, maybe with its server: "@ana@pug.so"), at the start of a word and up to the cursor
const PARTIAL_SHORTCODE = /(?:^|\s):([a-zA-Z0-9_]{2,})$/;
const PARTIAL_MENTION = /(?:^|\s)@([a-zA-Z0-9_]+(?:@[a-zA-Z0-9.-]*)?)$/;

export interface Token {
    trigger: ':' | '@';
    // Where the ":" or "@" is
    start: number;
    // What follows it, up to the cursor
    query: string;
}

// The emoji or mention being typed at the cursor. Not inside a word, so "10:30", links and e-mail addresses
// don't count, and not when the cursor sits in the middle of the word.
export const tokenAtCursor = (text: string, cursor: number): Token | null => {
    if (/^[\w:@]/.test(text.slice(cursor))) return null;
    const before = text.slice(0, cursor);
    const shortcode = PARTIAL_SHORTCODE.exec(before);
    if (shortcode) return { trigger: ':', start: cursor - shortcode[1].length - 1, query: shortcode[1] };
    const mention = PARTIAL_MENTION.exec(before);
    if (mention) return { trigger: '@', start: cursor - mention[1].length - 1, query: mention[1] };
    return null;
};

// Swaps what was half-typed (":neofox_som", "@an") for the full thing plus a space, cursor after it
export const completeToken = (text: string, start: number, cursor: number, replacement: string) => {
    const after = text.slice(cursor);
    const piece = `${replacement}${/^\s/.test(after) ? '' : ' '}`;
    return { text: text.slice(0, start) + piece + after, cursor: start + piece.length };
};

// Who to suggest for a mention: people you follow, then your server's (their acct has no server), then
// everyone else, each in the server's order. Your server counts you among those you follow, so you're left out.
export const rankMentions = <T extends { id: string; acct: string }>(following: T[], everyone: T[], myId?: string): T[] => {
    const followed = new Set(following.map(account => account.id));
    const others = everyone.filter(account => !followed.has(account.id));
    return [
        ...following,
        ...others.filter(account => !account.acct.includes('@')),
        ...others.filter(account => account.acct.includes('@')),
    ].filter(account => account.id !== myId);
};
