import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    CollectionFields,
    addToCollection,
    createCollection,
    deleteCollection,
    getAccountCollections,
    getCollection,
    leaveCollection,
    removeFromCollection,
    updateCollection,
} from '../services/mastodon/collections';
import { useInstanceConfiguration } from './useInstanceConfiguration';

// Someone's collections, on servers that have them (Mastodon 4.6); none elsewhere, without asking
export const useAccountCollections = (accountId: string) => {
    const { supportsCollections } = useInstanceConfiguration();
    const query = useQuery({
        queryKey: ['collections', 'account', accountId],
        queryFn: () => getAccountCollections(accountId),
        enabled: supportsCollections,
        staleTime: 5 * 60 * 1000,
    });
    return supportsCollections ? query.data ?? [] : [];
};

export const useCollection = (id: string, enabled = true) =>
    useQuery({
        queryKey: ['collections', id],
        queryFn: () => getCollection(id),
        enabled,
    });

// Changes to collections and their people; each refreshes every collection we have (everything under ['collections'])
export const useCollectionActions = () => {
    const queryClient = useQueryClient();
    const refresh = useCallback(() => queryClient.invalidateQueries({ queryKey: ['collections'] }), [queryClient]);
    const after = useCallback(
        <A extends unknown[], R>(task: (...args: A) => Promise<R>) =>
            async (...args: A) => {
                const result = await task(...args);
                await refresh();
                return result;
            },
        [refresh],
    );
    return {
        create: after((fields: CollectionFields, accountIds?: string[]) => createCollection(fields, accountIds)),
        update: after((id: string, fields: CollectionFields) => updateCollection(id, fields)),
        remove: after((id: string) => deleteCollection(id)),
        add: after((id: string, accountId: string) => addToCollection(id, accountId)),
        removeItem: after((id: string, itemId: string) => removeFromCollection(id, itemId)),
        leave: after((id: string, itemId: string) => leaveCollection(id, itemId)),
    };
};
