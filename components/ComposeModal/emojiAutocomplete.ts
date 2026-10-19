// A custom emoji being typed: ":" at the start of a word and at least two letters, up to the cursor
const PARTIAL_SHORTCODE = /(?:^|\s):([a-zA-Z0-9_]{2,})$/;

// What's being typed at the cursor, if it's a :shortcode, and where it starts. Not inside a word,
// so "10:30" and URLs don't count, and not when the cursor sits in the middle of the word.
export const shortcodeAtCursor = (text: string, cursor: number): { start: number; query: string } | null => {
    if (/^[\w:]/.test(text.slice(cursor))) return null;
    const match = PARTIAL_SHORTCODE.exec(text.slice(0, cursor));
    if (!match) return null;
    return { start: cursor - match[1].length - 1, query: match[1] };
};

// Swaps the half-typed ":neofox_som" for the full ":neofox_something: ", leaving the cursor after it
export const completeShortcode = (text: string, start: number, cursor: number, shortcode: string) => {
    const after = text.slice(cursor);
    const piece = `:${shortcode}:${/^\s/.test(after) ? '' : ' '}`;
    return { text: text.slice(0, start) + piece + after, cursor: start + piece.length };
};
