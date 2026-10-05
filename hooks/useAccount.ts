import { useQuery } from '@tanstack/react-query';
import { getAccount } from '../services/mastodon/accounts';
import { Account } from '../services/mastodon/types';

// An account by id. A copy we already have (from a post or notification) shows at once while it refreshes.
export const useAccount = (accountId: string, initialAccount?: Account) =>
    useQuery({
        queryKey: ['account', accountId],
        queryFn: () => getAccount(accountId),
        initialData: initialAccount,
        // Treat the passed copy as stale, so counts and bio get refreshed
        initialDataUpdatedAt: 0,
    });
