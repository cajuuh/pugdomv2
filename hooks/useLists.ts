import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    addToList,
    createList,
    deleteList,
    getAccountLists,
    getListAccounts,
    getLists,
    ListFields,
    removeFromList,
    updateList,
} from '../services/mastodon/lists';

export const LISTS_KEY = ['lists'];
const listAccountsKey = (listId: string) => ['lists', listId, 'accounts'];
const accountListsKey = (accountId: string) => ['lists', 'of', accountId];

export const useLists = (enabled = true) => useQuery({ queryKey: LISTS_KEY, queryFn: getLists, enabled });

export const useListAccounts = (listId: string | undefined) =>
    useQuery({ queryKey: listAccountsKey(listId ?? ''), queryFn: () => getListAccounts(listId!), enabled: !!listId });

export const useAccountLists = (accountId: string, enabled = true) =>
    useQuery({ queryKey: accountListsKey(accountId), queryFn: () => getAccountLists(accountId), enabled });

// Changes to lists and their members; each refreshes what it affects (everything under ['lists'])
export const useListActions = () => {
    const queryClient = useQueryClient();
    const refresh = useCallback(() => queryClient.invalidateQueries({ queryKey: LISTS_KEY }), [queryClient]);

    return {
        create: useCallback(async (fields: ListFields) => {
            const list = await createList(fields);
            await refresh();
            return list;
        }, [refresh]),
        update: useCallback(async (id: string, fields: ListFields) => {
            const list = await updateList(id, fields);
            await refresh();
            return list;
        }, [refresh]),
        remove: useCallback(async (id: string) => {
            await deleteList(id);
            await refresh();
        }, [refresh]),
        addMember: useCallback(async (listId: string, accountId: string) => {
            await addToList(listId, [accountId]);
            await refresh();
        }, [refresh]),
        removeMember: useCallback(async (listId: string, accountId: string) => {
            await removeFromList(listId, [accountId]);
            await refresh();
        }, [refresh]),
    };
};
