import { useQuery } from '@tanstack/react-query';
import { DEFAULT_INSTANCE_CONFIGURATION, fetchInstanceConfiguration } from '../services/mastodon/instance';

// Instance limits rarely change; fall back to Mastodon's defaults until (or if) they load
// `enabled` lets callers that are always mounted (like the compose modal) only fetch when needed
export const useInstanceConfiguration = (enabled = true) => {
    const { data } = useQuery({
        queryKey: ['instance', 'configuration'],
        queryFn: fetchInstanceConfiguration,
        staleTime: 60 * 60 * 1000,
        enabled,
    });
    return data ?? DEFAULT_INSTANCE_CONFIGURATION;
};
