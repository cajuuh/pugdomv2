import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { getStringSetting, saveStringSetting } from './storage';

export type ThemeType = 'light' | 'dark' | 'system';

export interface ThemeColors {
    background: string;
    cardBackground: string;
    borderColor: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    accentColor: string;
    tabBarBackground: string;
    tabBarActiveColor: string;
    tabBarInactiveColor: string;
    inputBackground: string;
    buttonTextColor: string;
    dangerColor: string;
    warningColor: string;
}

interface ThemeContextType {
    theme: ThemeType;
    setTheme: (theme: ThemeType) => Promise<void>;
    colors: ThemeColors;
    isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_KEY = 'pugdom_settings_theme';

export const lightColors: ThemeColors = {
    background: '#F0F4F8',
    cardBackground: 'rgba(255, 255, 255, 0.85)',
    borderColor: 'rgba(255, 255, 255, 0.5)',
    textPrimary: '#1E293B',
    textSecondary: '#475569',
    textMuted: '#94A3B8',
    accentColor: '#3B82F6',
    tabBarBackground: 'transparent',
    tabBarActiveColor: '#3B82F6',
    tabBarInactiveColor: '#94A3B8',
    inputBackground: 'rgba(255, 255, 255, 0.6)',
    buttonTextColor: '#FFFFFF',
    dangerColor: '#EF4444',
    warningColor: '#F59E0B',
};

export const darkColors: ThemeColors = {
    background: '#121318',
    cardBackground: 'rgba(30, 31, 38, 0.75)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    accentColor: '#00E5FF',
    tabBarBackground: 'transparent',
    tabBarActiveColor: '#00E5FF',
    tabBarInactiveColor: '#475569',
    inputBackground: 'rgba(255, 255, 255, 0.05)',
    buttonTextColor: '#121318',
    dangerColor: '#EF4444',
    warningColor: '#F59E0B',
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setThemeState] = useState<ThemeType>('system');
    const systemColorScheme = useColorScheme();

    useEffect(() => {
        const loadTheme = async () => {
            try {
                const storedTheme = await getStringSetting(THEME_KEY, 'system');
                setThemeState(storedTheme as ThemeType);
            } catch (error) {
                console.error('Failed to load theme:', error);
            }
        };
        loadTheme();
    }, []);

    const setTheme = async (newTheme: ThemeType) => {
        setThemeState(newTheme);
        await saveStringSetting(THEME_KEY, newTheme);
    };

    const isDark = theme === 'system' ? systemColorScheme === 'dark' : theme === 'dark';
    const colors = isDark ? darkColors : lightColors;

    return (
        <ThemeContext.Provider value={{ theme, setTheme, colors, isDark }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
