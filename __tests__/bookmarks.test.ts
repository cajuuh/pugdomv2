import apiClient from '../services/api/client';
import { getFavourites, nextMaxIdFromLink } from '../services/mastodon/bookmarks';

jest.mock('../services/api/client', () => ({ __esModule: true, default: { get: jest.fn() } }));

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

describe('getFavourites', () => {
    it('reads your favourites, with the next page from the Link header', async () => {
        (apiClient.get as jest.Mock).mockResolvedValue({ data: [{ id: 's1' }], headers: { link: '<https://pug.social/api/v1/favourites?max_id=77>; rel="next"' } });

        await expect(getFavourites('90')).resolves.toEqual({ statuses: [{ id: 's1' }], nextMaxId: '77' });
        expect(apiClient.get).toHaveBeenCalledWith('/favourites', { params: { max_id: '90' } });
    });
});
