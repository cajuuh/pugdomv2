import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { followAccount, getRelationships } from '../services/mastodon/accounts';
import { Relationship } from '../services/mastodon/types';

// Fetches relationships for all given accounts in one request, keyed by account id
export const useRelationships = (accountIds: string[]) => {
    const ids = Array.from(new Set(accountIds)).sort();
    const { data } = useQuery({
        queryKey: ['relationships', ids],
        queryFn: () => getRelationships(ids),
        enabled: ids.length > 0,
    });
    // Stable between fetches, so lists can use it as extraData without re-rendering every row each render
    return useMemo(() => new Map<string, Relationship>(data?.map(relationship => [relationship.id, relationship])), [data]);
};

// Follows an account and writes the returned relationship into every cached relationships query
export const useFollowAccount = () => {
    const queryClient = useQueryClient();
    return useCallback(async (accountId: string) => {
        const relationship = await followAccount(accountId);
        queryClient.setQueriesData<Relationship[]>({ queryKey: ['relationships'] }, (relationships) =>
            relationships?.map(existing => (existing.id === relationship.id ? relationship : existing))
        );
        return relationship;
    }, [queryClient]);
};
