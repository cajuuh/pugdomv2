import { feedFilterContext, filterMatch, withoutHidden } from '../services/mastodon/filters';
import { Filter, Status } from '../services/mastodon/types';

const filter = (over: Partial<Filter> = {}): Filter => ({
    id: 'f1', title: 'Spoilers', context: ['home', 'public'], expires_at: null, filter_action: 'warn', ...over,
});
const post = (id: string, filters: Filter[] = [], reblog: Status | null = null) =>
    ({ id, reblog, filtered: filters.map(f => ({ filter: f, keyword_matches: ['x'], status_matches: null })) }) as unknown as Status;

describe('filterMatch', () => {
    it('only counts filters for the context that have not expired', () => {
        expect(filterMatch(post('1', [filter()]), 'home')).toEqual({ action: 'warn', titles: ['Spoilers'] });
        expect(filterMatch(post('1', [filter()]), 'thread')).toBeNull();
        expect(filterMatch(post('1', [filter()]), undefined)).toBeNull();
        const expired = filter({ expires_at: '2026-01-01T00:00:00Z' });
        expect(filterMatch(post('1', [expired]), 'home', Date.parse('2026-02-01T00:00:00Z'))).toBeNull();
        expect(filterMatch(post('1', [expired]), 'home', Date.parse('2025-12-01T00:00:00Z'))?.action).toBe('warn');
    });

    it('picks the strongest action and lists the warn titles', () => {
        const blur = filter({ id: 'b', title: 'Gore', filter_action: 'blur' });
        const warn = filter({ id: 'w', title: 'Politics' });
        const hide = filter({ id: 'h', title: 'Ads', filter_action: 'hide' });
        expect(filterMatch(post('1', [blur]), 'home')).toEqual({ action: 'blur', titles: [] });
        expect(filterMatch(post('1', [blur, warn]), 'home')).toEqual({ action: 'warn', titles: ['Politics'] });
        expect(filterMatch(post('1', [warn, hide]), 'home')?.action).toBe('hide');
    });

    it("judges a boost by the boosted post's filters too", () => {
        expect(filterMatch(post('2', [], post('1', [filter({ filter_action: 'hide' })])), 'home')?.action).toBe('hide');
    });
});

describe('withoutHidden', () => {
    it('drops only posts a hide filter covers in that context', () => {
        const hidden = post('1', [filter({ filter_action: 'hide' })]);
        const warned = post('2', [filter()]);
        const plain = post('3');
        expect(withoutHidden([hidden, warned, plain], 'home').map(p => p.id)).toEqual(['2', '3']);
        expect(withoutHidden([hidden, warned, plain], 'account').map(p => p.id)).toEqual(['1', '2', '3']);
    });

    it('maps feeds to their filter context', () => {
        expect(feedFilterContext('home')).toBe('home');
        expect(feedFilterContext('list')).toBe('home');
        expect(feedFilterContext('hashtag')).toBe('public');
        expect(feedFilterContext('server')).toBeUndefined();
    });
});
