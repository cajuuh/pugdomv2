import { useQuery } from '@tanstack/react-query';
import { getAccountCollections, getCollection } from '../services/mastodon/collections';
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

export const useCollection = (id: string) =>
    useQuery({
        queryKey: ['collections', id],
        queryFn: () => getCollection(id),
    });
