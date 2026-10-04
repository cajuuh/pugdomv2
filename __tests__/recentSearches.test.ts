import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    addRecentSearch,
    clearRecentSearches,
    getRecentSearches,
    MAX_RECENT_SEARCHES,
    recentSearchKey,
    removeRecentSearch,
} from '../services/recentSearches';

describe('recent searches storage', () => {
    beforeEach(async () => {
        await AsyncStorage.clear();
        jest.clearAllMocks();
    });

    it('returns empty array when no searches stored', async () => {
        expect(await getRecentSearches('user1')).toEqual([]);
    });

    it('adds a search query to the top and retrieves it', async () => {
        const list = await addRecentSearch('pugs', 'user1');
        expect(list).toEqual(['pugs']);
        expect(await getRecentSearches('user1')).toEqual(['pugs']);
    });

    it('ignores empty and whitespace-only queries', async () => {
        await addRecentSearch('  ', 'user1');
        expect(await getRecentSearches('user1')).toEqual([]);
    });

    it('deduplicates case-insensitively and puts latest at the front', async () => {
        await addRecentSearch('pugs', 'user1');
        await addRecentSearch('dogs', 'user1');
        await addRecentSearch('PUGS', 'user1');

        const list = await getRecentSearches('user1');
        expect(list).toEqual(['PUGS', 'dogs']);
    });

    it('caps stored searches at MAX_RECENT_SEARCHES (10)', async () => {
        for (let i = 0; i < 15; i++) {
            await addRecentSearch(`search-${i}`, 'user1');
        }

        const list = await getRecentSearches('user1');
        expect(list).toHaveLength(MAX_RECENT_SEARCHES);
        expect(list[0]).toBe('search-14');
        expect(list[9]).toBe('search-5');
    });

    it('removes a specific search term', async () => {
        await addRecentSearch('pugs', 'user1');
        await addRecentSearch('cats', 'user1');

        const remaining = await removeRecentSearch('pugs', 'user1');
        expect(remaining).toEqual(['cats']);
        expect(await getRecentSearches('user1')).toEqual(['cats']);
    });

    it('clears all recent searches for an account', async () => {
        await addRecentSearch('pugs', 'user1');
        await addRecentSearch('cats', 'user2');

        await clearRecentSearches('user1');

        expect(await getRecentSearches('user1')).toEqual([]);
        expect(await getRecentSearches('user2')).toEqual(['cats']);
    });

    it('isolates recent searches by accountId', async () => {
        await addRecentSearch('pug', 'userA');
        await addRecentSearch('corgi', 'userB');

        expect(await getRecentSearches('userA')).toEqual(['pug']);
        expect(await getRecentSearches('userB')).toEqual(['corgi']);
    });

    it('handles corrupted JSON gracefully', async () => {
        await AsyncStorage.setItem(recentSearchKey('user1'), 'not-valid-json');
        expect(await getRecentSearches('user1')).toEqual([]);
    });
});
