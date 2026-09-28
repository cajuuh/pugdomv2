import { useQuery } from '@tanstack/react-query';
import { DEFAULT_INSTANCE_CONFIGURATION, fetchInstanceConfiguration } from '../services/mastodon/instance';

// Instance limits rarely change; fall back to Mastodon's defaults until (or if) they load
export const useInstanceConfiguration = () => {
    const { data } = useQuery({
        queryKey: ['instance', 'configuration'],
        queryFn: fetchInstanceConfiguration,
        staleTime: 60 * 60 * 1000,
    });
    return data ?? DEFAULT_INSTANCE_CONFIGURATION;
};
