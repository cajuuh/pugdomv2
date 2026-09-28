// Mirrors Mastodon's StatusLengthValidator: every http(s) URL counts as 23 characters, remote mentions
// count only their username part, and the CW text counts towards the same limit.
export const DEFAULT_MAX_CHARACTERS = 500;

const URL_PLACEHOLDER = 'x'.repeat(23);
// Only URLs with a scheme get the concession; the server doesn't shorten bare domains
const URL_REGEX = /(^|[^\w@/])(https?:\/\/[^\s<>"]+)/gi;
// @user@domain -> @user (same pattern as Mastodon's web composer)
const REMOTE_MENTION_REGEX = /(^|[^/\w])@(([a-z0-9_]+)@[a-z0-9.-]+[a-z0-9]+)/gi;

const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

// The server counts grapheme clusters; fall back to code points where Intl.Segmenter is unavailable
const graphemeLength = (text: string) =>
    segmenter ? Array.from(segmenter.segment(text)).length : Array.from(text).length;

// Trailing punctuation isn't part of the URL for the server's extractor, so it still counts
const TRAILING_PUNCTUATION = /[.,!?;:'")\]]+$/;

export const countableText = (text: string) =>
    text
        .replace(URL_REGEX, (_, prefix: string, url: string) => {
            const trailing = url.match(TRAILING_PUNCTUATION)?.[0] ?? '';
            return prefix + URL_PLACEHOLDER + trailing;
        })
        .replace(REMOTE_MENTION_REGEX, '$1@$3');

export const statusLength = (text: string, spoilerText = '') =>
    graphemeLength(spoilerText) + graphemeLength(countableText(text));
