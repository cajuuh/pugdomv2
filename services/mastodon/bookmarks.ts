import apiClient from '../api/client';
import { Status } from './types';

// A page of bookmarks and the cursor for the next one
export interface BookmarksPage {
    statuses: Status[];
    nextMaxId?: string;
}

// Bookmarks are ordered by when you saved them, so the next page's max_id is a bookmark id that
// only appears in the Link header (`<…/bookmarks?max_id=123>; rel="next"`), not a status id
export const nextMaxIdFromLink = (link?: string | null) => {
    const next = link?.split(',').find(part => /rel="next"/.test(part));
    return next?.match(/[?&]max_id=([^&>]+)/)?.[1];
};

export async function getBookmarks(maxId?: string): Promise<BookmarksPage> {
    const response = await apiClient.get<Status[]>('/bookmarks', { params: { max_id: maxId } });
    return { statuses: response.data, nextMaxId: nextMaxIdFromLink(response.headers?.link) };
}
