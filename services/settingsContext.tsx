import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSetting, getStringSetting, saveSetting, saveStringSetting } from './storage';

interface SettingsContextType {
    notifications: boolean;
    mediaAutoplay: boolean;
    compactMode: boolean;
    // Hides the reply, boost and favourite numbers under posts (the buttons stay)
    hideCounts: boolean;
    // Posts with a content warning open expanded; null until you set it here (then the account's web preference applies)
    expandSpoilers: boolean | null;
    // Hidden sensitive media gets a cover over the blur; off, it's only blurred
    coverSensitiveMedia: boolean;
    setNotifications: (value: boolean) => Promise<void>;
    setMediaAutoplay: (value: boolean) => Promise<void>;
    setCompactMode: (value: boolean) => Promise<void>;
    setHideCounts: (value: boolean) => Promise<void>;
    // Favourites and boosts of the same post share one notification row; off, each has its own
    groupNotifications: boolean;
    // Post images at their own shape instead of cropped to the card
    uncroppedMedia: boolean;
    setUncroppedMedia: (value: boolean) => Promise<void>;
    setGroupNotifications: (value: boolean) => Promise<void>;
    setExpandSpoilers: (value: boolean) => Promise<void>;
    setCoverSensitiveMedia: (value: boolean) => Promise<void>;
    loadingSettings: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const NOTIFICATIONS_KEY = 'pugdom_settings_notifications';
export const AUTOPLAY_KEY = 'pugdom_settings_autoplay';
export const COMPACT_KEY = 'pugdom_settings_compact';
export const HIDE_COUNTS_KEY = 'pugdom_settings_hide_counts';
export const GROUP_NOTIFICATIONS_KEY = 'pugdom_settings_group_notifications';
export const UNCROPPED_MEDIA_KEY = 'pugdom_settings_uncropped_media';
export const EXPAND_SPOILERS_KEY = 'pugdom_settings_expand_spoilers';
export const COVER_SENSITIVE_KEY = 'pugdom_settings_cover_sensitive';

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [notifications, setNotificationsState] = useState(true);
    const [mediaAutoplay, setMediaAutoplayState] = useState(false);
    const [compactMode, setCompactModeState] = useState(false);
    const [hideCounts, setHideCountsState] = useState(false);
    const [groupNotifications, setGroupNotificationsState] = useState(true);
    const [uncroppedMedia, setUncroppedMediaState] = useState(false);
    const [expandSpoilers, setExpandSpoilersState] = useState<boolean | null>(null);
    const [coverSensitiveMedia, setCoverSensitiveMediaState] = useState(true);
    const [loadingSettings, setLoadingSettings] = useState(true);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const notify = await getSetting(NOTIFICATIONS_KEY, true);
                const autoplay = await getSetting(AUTOPLAY_KEY, false);
                const compact = await getSetting(COMPACT_KEY, false);
                const counts = await getSetting(HIDE_COUNTS_KEY, false);
                const grouped = await getSetting(GROUP_NOTIFICATIONS_KEY, true);
                const uncropped = await getSetting(UNCROPPED_MEDIA_KEY, false);
                const spoilers = await getStringSetting(EXPAND_SPOILERS_KEY, '');
                const cover = await getSetting(COVER_SENSITIVE_KEY, true);
                setNotificationsState(notify);
                setMediaAutoplayState(autoplay);
                setCompactModeState(compact);
                setHideCountsState(counts);
                setGroupNotificationsState(grouped);
                setUncroppedMediaState(uncropped);
                setExpandSpoilersState(spoilers === '' ? null : spoilers === 'true');
                setCoverSensitiveMediaState(cover);
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

    const setGroupNotifications = async (value: boolean) => {
        setGroupNotificationsState(value);
        await saveSetting(GROUP_NOTIFICATIONS_KEY, value);
    };

    const setUncroppedMedia = async (value: boolean) => {
        setUncroppedMediaState(value);
        await saveSetting(UNCROPPED_MEDIA_KEY, value);
    };

    const setExpandSpoilers = async (value: boolean) => {
        setExpandSpoilersState(value);
        await saveStringSetting(EXPAND_SPOILERS_KEY, String(value));
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
                coverSensitiveMedia,
                setNotifications,
                setMediaAutoplay,
                setCompactMode,
                setHideCounts,
                groupNotifications,
                setGroupNotifications,
                uncroppedMedia,
                setUncroppedMedia,
                setExpandSpoilers,
                setCoverSensitiveMedia,
                loadingSettings,
            }}
        >
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};
