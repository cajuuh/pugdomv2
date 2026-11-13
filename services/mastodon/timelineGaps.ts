import { FeedRange, fetchFeedRange } from './feedService';
import { getHomeMarker } from './markers';
import { getStatus } from './statuses';
import { Status } from './types';

// Posts are missing between `above` (newer) and `below` (older)
export interface Gap {
    gap: true;
    id: string;
    above: string;
    below: string;
}
export type FeedItem = Status | Gap;
export const isGap = (item: FeedItem): item is Gap => 'gap' in item;

// above → below
export type Gaps = Record<string, string>;
export type GapEnd = 'newer' | 'older';

// Mastodon's page cap. Fewer back means the gap is closed.
export const GAP_LIMIT = 40;

// Ids are numbers too big for JavaScript, sent as strings: the longer one is newer
export const compareIds = (a: string, b: string) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0);
export const newestFirst = (posts: Status[]) => [...posts].sort((a, b) => compareIds(b.id, a.id));

// What the list draws: the posts `shows` keeps, and a row wherever a gap is. A gap whose two posts
// aren't next to each other anymore (a reload filled it) isn't drawn.
export const feedItems = (posts: Status[], gaps: Gaps, shows: (post: Status) => boolean): FeedItem[] => {
    const items: FeedItem[] = [];
    posts.forEach((post, i) => {
        if (shows(post)) items.push(post);
        const below = posts[i + 1];
        if (below && gaps[post.id] === below.id) items.push({ gap: true, id: `gap-${post.id}`, above: post.id, below: below.id });
    });
    return items;
};

const unknownTo = (pages: Status[][]) => {
    const known = new Set(pages.flat().map(post => post.id));
    return (posts: Status[]) => newestFirst(posts).filter(post => !known.has(post.id));
};

// Into the gap under `aboveId`
export const insertAfter = (pages: Status[][], aboveId: string, posts: Status[]): Status[][] => {
    const fresh = unknownTo(pages)(posts);
    return pages.map(page => {
        const at = page.findIndex(post => post.id === aboveId);
        return at < 0 ? page : [...page.slice(0, at + 1), ...fresh, ...page.slice(at + 1)];
    });
};

export const prepend = (pages: Status[][], posts: Status[]): Status[][] => {
    const fresh = unknownTo(pages)(posts);
    return [[...fresh, ...(pages[0] ?? [])], ...pages.slice(1)];
};

// Newer fills from the bottom (just above `below`), older from the top (just under `above`)
export const gapRange = (gap: Gap, from: GapEnd): FeedRange =>
    from === 'newer' ? { min_id: gap.below, max_id: gap.above, limit: GAP_LIMIT } : { max_id: gap.above, since_id: gap.below, limit: GAP_LIMIT };

// The gaps once `fetched` went in: gone with less than a page, else moved to the end that was loaded
export const afterLoad = (gaps: Gaps, gap: Gap, fetched: Status[], from: GapEnd): Gaps => {
    const { [gap.above]: _filled, ...rest } = gaps;
    if (fetched.length < GAP_LIMIT) return rest;
    const sorted = newestFirst(fetched);
    return from === 'newer' ? { ...rest, [gap.above]: sorted[0].id } : { ...rest, [sorted[sorted.length - 1].id]: gap.below };
};

export interface RestoredHome {
    posts: Status[];
    gaps: Gaps;
    // The post to open on
    anchor: string;
}

// Home where you left it (the home marker): that post with what's just above and under it, and the
// newest posts on top, with a gap between when they don't meet. Null without a marker.
export async function restoreHome(): Promise<RestoredHome | null> {
    const anchor = await getHomeMarker();
    if (!anchor) return null;
    const home = { id: 'home', kind: 'home' } as const;
    const [newest, above, marked, below] = await Promise.all([
        fetchFeedRange(home, { limit: GAP_LIMIT }),
        fetchFeedRange(home, { min_id: anchor, limit: GAP_LIMIT }),
        // Deleted since: open on the post under it
        getStatus(anchor).catch(() => null),
        fetchFeedRange(home, { max_id: anchor }),
    ]);
    const top = newestFirst(newest);
    const middle = unknownTo([top])([...above, ...(marked ? [marked] : []), ...below]);
    const meet = above.length < GAP_LIMIT || middle.length < above.length + below.length + (marked ? 1 : 0);
    const gaps: Gaps = !meet && top.length && middle.length ? { [top[top.length - 1].id]: middle[0].id } : {};
    return { posts: [...top, ...middle], gaps, anchor };
}
