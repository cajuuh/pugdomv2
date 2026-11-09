const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", nbsp: ' ' };

// Mastodon adds "RE: <link>" to quote posts for apps that can't show quotes; apps that do, hide it
export const withoutQuoteInline = (html: string) =>
    html.replace(/<p[^>]*\bclass="[^"]*\bquote-inline\b[^"]*"[^>]*>[\s\S]*?<\/p>/gi, '');

// Post HTML as plain text, keeping paragraph and line breaks
export const plainText = (html?: string) =>
    withoutQuoteInline(html ?? '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&(amp|lt|gt|quot|apos|#39|nbsp);/g, (_, entity: string) => ENTITIES[entity])
        .trim();

const isHashtagLine = (html: string) => {
    const words = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().split(/\s+/);
    return words.every(word => /^#[\p{L}\p{N}_·]+$/u.test(word));
};

// A post's last lines when they're only hashtags, taken out of its text to show below its media, as
// Mastodon's web app does. A post that's nothing but hashtags keeps them as its text, unless it has
// something else to show (media, a link card, a poll, a quote): then they go below that too.
export const splitTrailingHashtags = (html: string, hasMore = false): { html: string; tags: string[] } => {
    const last = html.match(/^([\s\S]*<p[^>]*>)([\s\S]*?)(<\/p>\s*)$/);
    const whole = { html, tags: [] as string[] };
    if (!last) return whole;
    const [, before, inner, after] = last;
    const lines = inner.split(/<br\s*\/?>/i);
    let keep = lines.length;
    while (keep > 0 && isHashtagLine(lines[keep - 1])) keep--;
    if (keep === lines.length) return whole;

    const tags = lines.slice(keep).join(' ').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().split(/\s+/).map(word => word.slice(1));
    const open = before.match(/<p[^>]*>$/)![0];
    const text = keep > 0 ? `${before}${lines.slice(0, keep).join('<br>')}${after}` : before.slice(0, -open.length);
    if (plainText(text)) return { html: text, tags };
    return hasMore ? { html: '', tags } : whole;
};

// Long posts fold in timelines behind "Show more". Past HUGE_POST characters (posts made to choke apps)
// the timeline doesn't draw their HTML at all, only the start as plain text, until asked.
export const LONG_POST = 800;
export const HUGE_POST = 5000;
const LONG_POST_LINES = 15;
export const postSize = (text: string): 'normal' | 'long' | 'huge' => {
    if (text.length > HUGE_POST) return 'huge';
    if (text.length > LONG_POST || (text.match(/\n/g)?.length ?? 0) >= LONG_POST_LINES) return 'long';
    return 'normal';
};

// A run with no spaces ("AAAA…" or a long URL) gets a zero-width space every 40 characters, so it wraps
// the same way on iOS and Android. Only text between tags; entities like &amp; and emoji stay whole.
export const breakLongRuns = (html: string) =>
    html.replace(/(^|>)([^<]+)/g, (_, open: string, text: string) => open + text.replace(/(?:&#?\w+;|(?!&#?\w+;)\S){40}(?=\S)/gu, '$&\u200B'));
