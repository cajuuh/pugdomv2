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

export type MediaDisplay = 'default' | 'show_all' | 'hide_all';

// How post media shows: "show_all" without the sensitive blur, "hide_all" veiled even when not sensitive,
// "default" veiled only when sensitive. The app's switch wins once used; otherwise the account's
// "Media display" from the web. Hiding everything only comes from the account.
export const useMediaDisplay = (): MediaDisplay => {
    const { showSensitiveMedia } = useSettings();
    const { data } = useServerPreferences();
    const account = data?.['reading:expand:media'];
    if (showSensitiveMedia === true) return 'show_all';
    if (account === 'hide_all') return 'hide_all';
    if (showSensitiveMedia === null && account === 'show_all') return 'show_all';
    return 'default';
};
