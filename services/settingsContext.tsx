import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSetting, saveSetting } from './storage';

interface SettingsContextType {
    notifications: boolean;
    mediaAutoplay: boolean;
    compactMode: boolean;
    setNotifications: (value: boolean) => Promise<void>;
    setMediaAutoplay: (value: boolean) => Promise<void>;
    setCompactMode: (value: boolean) => Promise<void>;
    loadingSettings: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const NOTIFICATIONS_KEY = 'pugdom_settings_notifications';
export const AUTOPLAY_KEY = 'pugdom_settings_autoplay';
export const COMPACT_KEY = 'pugdom_settings_compact';

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [notifications, setNotificationsState] = useState(true);
    const [mediaAutoplay, setMediaAutoplayState] = useState(false);
    const [compactMode, setCompactModeState] = useState(false);
    const [loadingSettings, setLoadingSettings] = useState(true);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const notify = await getSetting(NOTIFICATIONS_KEY, true);
                const autoplay = await getSetting(AUTOPLAY_KEY, false);
                const compact = await getSetting(COMPACT_KEY, false);
                setNotificationsState(notify);
                setMediaAutoplayState(autoplay);
                setCompactModeState(compact);
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

    return (
        <SettingsContext.Provider
            value={{
                notifications,
                mediaAutoplay,
                compactMode,
                setNotifications,
                setMediaAutoplay,
                setCompactMode,
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
