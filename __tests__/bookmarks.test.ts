import { nextMaxIdFromLink } from '../services/mastodon/bookmarks';

describe('nextMaxIdFromLink', () => {
    it('reads the next page cursor from a Mastodon Link header', () => {
        const link =
            '<https://mastodon.social/api/v1/bookmarks?max_id=113>; rel="next", <https://mastodon.social/api/v1/bookmarks?min_id=140>; rel="prev"';
        expect(nextMaxIdFromLink(link)).toBe('113');
    });

    it('finds max_id after other params and ignores the prev link', () => {
        const link =
            '<https://pug.social/api/v1/bookmarks?min_id=140>; rel="prev", <https://pug.social/api/v1/bookmarks?limit=20&max_id=99>; rel="next"';
        expect(nextMaxIdFromLink(link)).toBe('99');
    });

    it('has no next page without a next link', () => {
        expect(nextMaxIdFromLink('<https://pug.social/api/v1/bookmarks?min_id=140>; rel="prev"')).toBeUndefined();
        expect(nextMaxIdFromLink(undefined)).toBeUndefined();
    });
});
