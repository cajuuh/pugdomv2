import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSetting, getStringSetting, saveSetting, saveStringSetting } from './storage';
import { DEFAULT_PUSH_ALERTS, PushAlerts, PushAlertType } from './push';
import { setExternalBrowser as setLinksBrowser } from './links';
import { setAbsoluteDates as setDatesAbsolute } from './dates';

// How big post text is, in both modes; 'default' keeps each mode's own size
export type PostTextSize = 'small' | 'default' | 'large' | 'larger';
export const POST_TEXT_SIZES: PostTextSize[] = ['small', 'default', 'large', 'larger'];

interface SettingsContextType {
    notifications: boolean;
    mediaAutoplay: boolean;
    compactMode: boolean;
    // Hides the reply, boost and favourite numbers under posts (the buttons stay)
    hideCounts: boolean;
    // Posts with a content warning open expanded; null until you set it here (then the account's web preference applies)
    expandSpoilers: boolean | null;
    // Sensitive media shown without the blur; null until switched in the app, so the account's setting applies
    showSensitiveMedia: boolean | null;
    // Hidden sensitive media gets a cover over the blur; off, it's only blurred
    coverSensitiveMedia: boolean;
    setNotifications: (value: boolean) => Promise<void>;
    // Which kinds of notifications are pushed (when `notifications` is on)
    pushAlerts: PushAlerts;
    setPushAlert: (type: PushAlertType, value: boolean) => Promise<void>;
    setMediaAutoplay: (value: boolean) => Promise<void>;
    setCompactMode: (value: boolean) => Promise<void>;
    setHideCounts: (value: boolean) => Promise<void>;
    // Swiping sideways on the timeline moves between the pinned feeds
    swipeFeeds: boolean;
    setSwipeFeeds: (value: boolean) => Promise<void>;
    // Home shows boosts / replies (off hides them, like the web app's Home settings)
    homeBoosts: boolean;
    setHomeBoosts: (value: boolean) => Promise<void>;
    homeReplies: boolean;
    setHomeReplies: (value: boolean) => Promise<void>;
    // Reopen Home where you left it, and keep what's loaded when new posts arrive (gap rows)
    keepPlace: boolean;
    setKeepPlace: (value: boolean) => Promise<void>;
    // Replies to public posts start as unlisted
    replyUnlisted: boolean;
    setReplyUnlisted: (value: boolean) => Promise<void>;
    // Favourites and boosts of the same post share one notification row; off, each has its own
    groupNotifications: boolean;
    // Post images at their own shape instead of cropped to the card
    uncroppedMedia: boolean;
    setUncroppedMedia: (value: boolean) => Promise<void>;
    // Posts with several images show them all at once in a grid, instead of the carousel
    mediaGrid: boolean;
    setMediaGrid: (value: boolean) => Promise<void>;
    // Links open in the phone's own browser instead of the in-app one
    externalBrowser: boolean;
    setExternalBrowser: (value: boolean) => Promise<void>;
    // Dates as the date and time instead of "3h"
    absoluteDates: boolean;
    setAbsoluteDates: (value: boolean) => Promise<void>;
    setGroupNotifications: (value: boolean) => Promise<void>;
    setExpandSpoilers: (value: boolean) => Promise<void>;
    setShowSensitiveMedia: (value: boolean) => Promise<void>;
    setCoverSensitiveMedia: (value: boolean) => Promise<void>;
    postTextSize: PostTextSize;
    setPostTextSize: (value: PostTextSize) => Promise<void>;
    loadingSettings: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const NOTIFICATIONS_KEY = 'pugdom_settings_notifications';
export const PUSH_ALERTS_KEY = 'pugdom_settings_push_alerts';
export const AUTOPLAY_KEY = 'pugdom_settings_autoplay';
export const COMPACT_KEY = 'pugdom_settings_compact';
export const HIDE_COUNTS_KEY = 'pugdom_settings_hide_counts';
export const SWIPE_FEEDS_KEY = 'pugdom_settings_swipe_feeds';
export const HOME_BOOSTS_KEY = 'pugdom_settings_home_boosts';
export const HOME_REPLIES_KEY = 'pugdom_settings_home_replies';
export const KEEP_PLACE_KEY = 'pugdom_settings_keep_place';
export const REPLY_UNLISTED_KEY = 'pugdom_settings_reply_unlisted';
export const GROUP_NOTIFICATIONS_KEY ='pugdom_settings_group_notifications';
export const UNCROPPED_MEDIA_KEY = 'pugdom_settings_uncropped_media';
export const MEDIA_GRID_KEY = 'pugdom_settings_media_grid';
export const ABSOLUTE_DATES_KEY = 'pugdom_settings_absolute_dates';
export const EXPAND_SPOILERS_KEY = 'pugdom_settings_expand_spoilers';
export const SHOW_SENSITIVE_KEY = 'pugdom_settings_show_sensitive';
export const COVER_SENSITIVE_KEY = 'pugdom_settings_cover_sensitive';
export const EXTERNAL_BROWSER_KEY = 'pugdom_settings_external_browser';
export const POST_TEXT_SIZE_KEY = 'pugdom_settings_post_text_size';

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [notifications, setNotificationsState] = useState(true);
    const [pushAlerts, setPushAlertsState] = useState<PushAlerts>(DEFAULT_PUSH_ALERTS);
    const [mediaAutoplay, setMediaAutoplayState] = useState(false);
    const [compactMode, setCompactModeState] = useState(false);
    const [hideCounts, setHideCountsState] = useState(false);
    const [swipeFeeds, setSwipeFeedsState] = useState(false);
    const [homeBoosts, setHomeBoostsState] = useState(true);
    const [homeReplies, setHomeRepliesState] = useState(true);
    const [keepPlace, setKeepPlaceState] = useState(false);
    const [replyUnlisted, setReplyUnlistedState] = useState(false);
    const [groupNotifications, setGroupNotificationsState] = useState(true);
    const [uncroppedMedia, setUncroppedMediaState] = useState(true);
    const [mediaGrid, setMediaGridState] = useState(false);
    const [absoluteDates, setAbsoluteDatesState] = useState(false);
    const [externalBrowser, setExternalBrowserState] = useState(false);
    const [postTextSize, setPostTextSizeState] = useState<PostTextSize>('default');
    const [expandSpoilers, setExpandSpoilersState] = useState<boolean | null>(null);
    const [showSensitiveMedia, setShowSensitiveMediaState] = useState<boolean | null>(null);
    const [coverSensitiveMedia, setCoverSensitiveMediaState] = useState(true);
    const [loadingSettings, setLoadingSettings] = useState(true);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const notify = await getSetting(NOTIFICATIONS_KEY, true);
                const alerts = await getStringSetting(PUSH_ALERTS_KEY, '');
                const autoplay = await getSetting(AUTOPLAY_KEY, false);
                const compact = await getSetting(COMPACT_KEY, false);
                const counts = await getSetting(HIDE_COUNTS_KEY, false);
                const swipe = await getSetting(SWIPE_FEEDS_KEY, false);
                const boosts = await getSetting(HOME_BOOSTS_KEY, true);
                const replies = await getSetting(HOME_REPLIES_KEY, true);
                const place = await getSetting(KEEP_PLACE_KEY, false);
                const unlistedReplies = await getSetting(REPLY_UNLISTED_KEY, false);
                const grouped = await getSetting(GROUP_NOTIFICATIONS_KEY, true);
                const uncropped = await getSetting(UNCROPPED_MEDIA_KEY, true);
                const grid = await getSetting(MEDIA_GRID_KEY, false);
                const absolute = await getSetting(ABSOLUTE_DATES_KEY, false);
                const spoilers = await getStringSetting(EXPAND_SPOILERS_KEY, '');
                const sensitive = await getStringSetting(SHOW_SENSITIVE_KEY, '');
                const cover = await getSetting(COVER_SENSITIVE_KEY, true);
                const external = await getSetting(EXTERNAL_BROWSER_KEY, false);
                const textSize = await getStringSetting(POST_TEXT_SIZE_KEY, 'default');
                setNotificationsState(notify);
                // Types added in later versions start on
                setPushAlertsState({ ...DEFAULT_PUSH_ALERTS, ...(alerts ? JSON.parse(alerts) : {}) });
                setMediaAutoplayState(autoplay);
                setCompactModeState(compact);
                setHideCountsState(counts);
                setSwipeFeedsState(swipe);
                setHomeBoostsState(boosts);
                setHomeRepliesState(replies);
                setKeepPlaceState(place);
                setReplyUnlistedState(unlistedReplies);
                setGroupNotificationsState(grouped);
                setUncroppedMediaState(uncropped);
                setMediaGridState(grid);
                setAbsoluteDatesState(absolute);
                setDatesAbsolute(absolute);
                setExpandSpoilersState(spoilers === '' ? null : spoilers === 'true');
                setShowSensitiveMediaState(sensitive === '' ? null : sensitive === 'true');
                setCoverSensitiveMediaState(cover);
                setExternalBrowserState(external);
                setLinksBrowser(external);
                if ((POST_TEXT_SIZES as string[]).includes(textSize)) setPostTextSizeState(textSize as PostTextSize);
            } catch (error) {
                console.error('Failed to load settings:', error);
            } finally {
                setLoadingSettings(false);
            }
        };
        loadSettings();
    }, []);

    const setNotifications = async (value: boolean) => {
        setNotificationsState(value);
        await saveSetting(NOTIFICATIONS_KEY, value);
    };

    const setPushAlert = async (type: PushAlertType, value: boolean) => {
        const next = { ...pushAlerts, [type]: value };
        setPushAlertsState(next);
        await saveStringSetting(PUSH_ALERTS_KEY, JSON.stringify(next));
    };

    const setMediaAutoplay = async (value: boolean) => {
        setMediaAutoplayState(value);
        await saveSetting(AUTOPLAY_KEY, value);
    };

    const setCompactMode = async (value: boolean) => {
        setCompactModeState(value);
        await saveSetting(COMPACT_KEY, value);
    };

    const setHideCounts = async (value: boolean) => {
        setHideCountsState(value);
        await saveSetting(HIDE_COUNTS_KEY, value);
    };

    const setSwipeFeeds = async (value: boolean) => {
        setSwipeFeedsState(value);
        await saveSetting(SWIPE_FEEDS_KEY, value);
    };

    const setHomeBoosts = async (value: boolean) => {
        setHomeBoostsState(value);
        await saveSetting(HOME_BOOSTS_KEY, value);
    };

    const setHomeReplies = async (value: boolean) => {
        setHomeRepliesState(value);
        await saveSetting(HOME_REPLIES_KEY, value);
    };

    const setKeepPlace = async (value: boolean) => {
        setKeepPlaceState(value);
        await saveSetting(KEEP_PLACE_KEY, value);
    };

    const setGroupNotifications = async (value: boolean) => {
        setGroupNotificationsState(value);
        await saveSetting(GROUP_NOTIFICATIONS_KEY, value);
    };

    const setAbsoluteDates = async (value: boolean) => {
        setAbsoluteDatesState(value);
        setDatesAbsolute(value);
        await saveSetting(ABSOLUTE_DATES_KEY, value);
    };

    const setMediaGrid = async (value: boolean) => {
        setMediaGridState(value);
        await saveSetting(MEDIA_GRID_KEY, value);
    };

    const setUncroppedMedia = async (value: boolean) => {
        setUncroppedMediaState(value);
        await saveSetting(UNCROPPED_MEDIA_KEY, value);
    };
    const setExternalBrowser = async (value: boolean) => {
        setExternalBrowserState(value);
        setLinksBrowser(value);
        await saveSetting(EXTERNAL_BROWSER_KEY, value);
    };

    const setShowSensitiveMedia = async (value: boolean) => {
        setShowSensitiveMediaState(value);
        await saveStringSetting(SHOW_SENSITIVE_KEY, String(value));
    };

    const setExpandSpoilers = async (value: boolean) => {
        setExpandSpoilersState(value);
        await saveStringSetting(EXPAND_SPOILERS_KEY, String(value));
    };

    const setReplyUnlisted = async (value: boolean) => {
        setReplyUnlistedState(value);
        await saveSetting(REPLY_UNLISTED_KEY, value);
    };

    const setPostTextSize = async (value: PostTextSize) => {
        setPostTextSizeState(value);
        await saveStringSetting(POST_TEXT_SIZE_KEY, value);
    };

    const setCoverSensitiveMedia = async (value: boolean) => {
        setCoverSensitiveMediaState(value);
        await saveSetting(COVER_SENSITIVE_KEY, value);
    };

    return (
        <SettingsContext.Provider
            value={{
                notifications,
                mediaAutoplay,
                compactMode,
                hideCounts,
                expandSpoilers,
                showSensitiveMedia,
                coverSensitiveMedia,
                setNotifications,
                pushAlerts,
                setPushAlert,
                setMediaAutoplay,
                setCompactMode,
                setHideCounts,
                swipeFeeds,
                setSwipeFeeds,
                homeBoosts,
                setHomeBoosts,
                homeReplies,
                setHomeReplies,
                keepPlace,
                setKeepPlace,
                replyUnlisted,
                setReplyUnlisted,
                groupNotifications,
                setGroupNotifications,
                uncroppedMedia,
                setUncroppedMedia,
                mediaGrid,
                setMediaGrid,
                absoluteDates,
                setAbsoluteDates,
                externalBrowser,
                setExternalBrowser,
                setExpandSpoilers,
                setShowSensitiveMedia,
                setCoverSensitiveMedia,
                postTextSize,
                setPostTextSize,
                loadingSettings,
            }}
        >
            {children}
        </SettingsContext.Provider>
    );
};

// For components that also render outside the provider (tests, previews): null there
export const useOptionalSettings = () => useContext(SettingsContext) ?? null;

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};
