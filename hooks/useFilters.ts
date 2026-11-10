import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFilter, deleteFilter, FilterFields, getFilters, updateFilter } from '../services/mastodon/filters';

export const FILTERS_KEY = ['filters'];

export const useFilters = () => useQuery({ queryKey: FILTERS_KEY, queryFn: getFilters });

// Each change reloads the filters and the posts, which carry what the filters match (`filtered`)
export const useFilterActions = () => {
    const queryClient = useQueryClient();
    const refresh = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['timeline'] });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        return queryClient.invalidateQueries({ queryKey: FILTERS_KEY });
    }, [queryClient]);
    return {
        save: useCallback(async (id: string | undefined, fields: FilterFields) => {
            await (id ? updateFilter(id, fields) : createFilter(fields));
            await refresh();
        }, [refresh]),
        remove: useCallback(async (id: string) => {
            await deleteFilter(id);
            await refresh();
        }, [refresh]),
    };
};
