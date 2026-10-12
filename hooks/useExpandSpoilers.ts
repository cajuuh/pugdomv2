import { useQuery } from '@tanstack/react-query';
import { useOptionalAuth } from '../services/authContext';
import { useSettings } from '../services/settingsContext';
import { getPreferences } from '../services/mastodon/preferences';

export const preferencesKey = (accountId: string) => ['preferences', accountId];

// The signed-in account's web preferences; they rarely change, so they're fetched once a while
export const useServerPreferences = () => {
    const accountId = useOptionalAuth()?.user?.id;
    return useQuery({
        queryKey: preferencesKey(accountId ?? ''),
        queryFn: getPreferences,
        enabled: !!accountId,
        staleTime: 30 * 60_000,
    });
};

// Whether posts with a content warning open expanded: the app's switch once you've used it,
// otherwise the account's "Always expand posts marked with content warnings" from the web
export const useExpandSpoilers = () => {
    const { expandSpoilers } = useSettings();
    const { data } = useServerPreferences();
    return expandSpoilers ?? data?.['reading:expand:spoilers'] === true;
};
