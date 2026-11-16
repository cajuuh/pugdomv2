import apiClient from '../services/api/client';
import { getHomeMarker, saveHomeMarker } from '../services/mastodon/markers';
import {
    afterLoad,
    compareIds,
    feedItems,
    Gap,
    GAP_LIMIT,
    gapRange,
    insertAfter,
    isGap,
    prepend,
    restoreHome,
} from '../services/mastodon/timelineGaps';
import { Status } from '../services/mastodon/types';

jest.mock('../services/api/client', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() }, publicClient: { get: jest.fn() } }));

const api = apiClient as unknown as Record<'get' | 'post', jest.Mock>;
const post = (id: string, extra: Partial<Status> = {}) => ({ id, visibility: 'public', ...extra } as Status);
const ids = (posts: { id: string }[]) => posts.map(p => p.id);
const run = (from: number, count: number) => Array.from({ length: count }, (_, i) => post(String(from - i)));
const gap = (above: string, below: string): Gap => ({ gap: true, id: `gap-${above}`, above, below });

beforeEach(() => jest.clearAllMocks());

describe('ids', () => {
    it('orders ids too big for numbers', () => {
        expect(compareIds('113000000000000001', '112999999999999999')).toBeGreaterThan(0);
        expect(compareIds('99', '100')).toBeLessThan(0);
        expect(compareIds('7', '7')).toBe(0);
    });
});

describe('feedItems', () => {
    it('draws a gap only where its two posts are next to each other', () => {
        const posts = [post('9'), post('5'), post('4')];
        expect(ids(feedItems(posts, { '9': '5' }, () => true))).toEqual(['9', 'gap-9', '5', '4']);
        // A reload put posts between them: the gap was filled
        expect(ids(feedItems([post('9'), post('7'), post('5')], { '9': '5' }, () => true))).toEqual(['9', '7', '5']);
    });

    it('keeps the gap when a post next to it is hidden', () => {
        const items = feedItems([post('9', { visibility: 'direct' }), post('5')], { '9': '5' }, p => p.visibility !== 'direct');
        expect(items.map(item => (isGap(item) ? 'gap' : item.id))).toEqual(['gap', '5']);
    });
});

describe('loading into a gap', () => {
    const pages = [[post('9'), post('8')], [post('5'), post('4')]];

    it('asks for the posts just above the older end, or just under the newer end', () => {
        expect(gapRange(gap('8', '5'), 'newer')).toEqual({ min_id: '5', max_id: '8', limit: GAP_LIMIT });
        expect(gapRange(gap('8', '5'), 'older')).toEqual({ max_id: '8', since_id: '5', limit: GAP_LIMIT });
    });

    it('puts posts in between, newest first, without ones already there', () => {
        expect(ids(insertAfter(pages, '8', [post('6'), post('7'), post('9')]).flat())).toEqual(['9', '8', '7', '6', '5', '4']);
    });

    it('closes the gap with less than a page, else moves it to the end that was loaded', () => {
        expect(afterLoad({ '8': '5' }, gap('8', '5'), [post('7')], 'newer')).toEqual({});
        const full = run(300, GAP_LIMIT);
        expect(afterLoad({ '8': '5' }, gap('8', '5'), full, 'newer')).toEqual({ '8': '300' });
        expect(afterLoad({ '8': '5' }, gap('8', '5'), full, 'older')).toEqual({ '261': '5' });
    });

    it('puts new posts on top', () => {
        expect(ids(prepend(pages, [post('11'), post('9'), post('10')]).flat())).toEqual(['11', '10', '9', '8', '5', '4']);
    });
});

describe('Home marker', () => {
    it('saves and reads the first post on screen', async () => {
        await saveHomeMarker('42');
        expect(api.post).toHaveBeenCalledWith('/markers', { home: { last_read_id: '42' } });

        api.get.mockResolvedValueOnce({ data: { home: { last_read_id: '42' } } });
        expect(await getHomeMarker()).toBe('42');
        expect(api.get).toHaveBeenCalledWith('/markers', { params: { timeline: ['home'] } });
    });
});

describe('restoreHome', () => {
    const answer = (newest: Status[], above: Status[], below: Status[], marked: Status | null = post('100')) =>
        api.get.mockImplementation(async (url: string, config?: { params?: Record<string, unknown> }) => {
            const params = config?.params ?? {};
            if (url === '/markers') return { data: { home: { last_read_id: '100' } } };
            if (url === '/statuses/100') {
                if (!marked) throw new Error('gone');
                return { data: marked };
            }
            if (params.min_id) return { data: above };
            if (params.max_id) return { data: below };
            return { data: newest };
        });

    it('opens on the saved post, with a gap under the newest posts when they are far above', async () => {
        answer(run(500, GAP_LIMIT), run(140, GAP_LIMIT), run(99, 20));
        const restored = (await restoreHome())!;

        expect(restored.anchor).toBe('100');
        expect(ids(restored.posts).slice(38, 43)).toEqual(['462', '461', '140', '139', '138']);
        expect(restored.posts.map(p => p.id)).toContain('100');
        expect(restored.gaps).toEqual({ '461': '140' });
    });

    it('has no gap when the newest posts reach it', async () => {
        answer(run(105, 10), run(105, 5), run(99, 20));
        const restored = (await restoreHome())!;

        expect(ids(restored.posts).slice(0, 7)).toEqual(['105', '104', '103', '102', '101', '100', '99']);
        expect(restored.gaps).toEqual({});
    });

    it('still opens there when the saved post was deleted', async () => {
        answer(run(110, 5), run(110, 10), run(99, 20), null);
        const restored = (await restoreHome())!;
        expect(ids(restored.posts)).not.toContain('100');
        expect(ids(restored.posts)).toContain('99');
    });

    it('gives null without a saved position', async () => {
        api.get.mockResolvedValueOnce({ data: {} });
        expect(await restoreHome()).toBeNull();
    });
});
