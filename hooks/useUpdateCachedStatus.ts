import { useCallback } from 'react';
import { InfiniteData, useQueryClient } from '@tanstack/react-query';
import { Status } from '../services/mastodon/types';

// Replaces a status in every cached timeline, including where it appears as a boost
export const useUpdateCachedStatus = () => {
    const queryClient = useQueryClient();

    return useCallback((updated: Status) => {
        queryClient.setQueriesData<InfiniteData<Status[]>>({ queryKey: ['timeline'] }, (data) => {
            if (!data) {
                return data;
            }
            return {
                ...data,
                pages: data.pages.map(page => page.map(status => {
                    if (status.id === updated.id) {
                        return updated;
                    }
                    if (status.reblog?.id === updated.id) {
                        return { ...status, reblog: updated };
                    }
                    return status;
                })),
            };
        });
    }, [queryClient]);
};
