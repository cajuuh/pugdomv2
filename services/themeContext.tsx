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
    background: '#F8FAFC',
    cardBackground: '#FFFFFF',
    borderColor: '#E2E8F0',
    textPrimary: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#94A3B8',
    accentColor: '#4F46E5',
    tabBarBackground: '#FFFFFF',
    tabBarActiveColor: '#4F46E5',
    tabBarInactiveColor: '#64748B',
    inputBackground: '#F1F5F9',
    buttonTextColor: '#FFFFFF',
    dangerColor: '#EF4444',
};

export const darkColors: ThemeColors = {
    background: '#0F172A',
    cardBackground: '#1E293B',
    borderColor: '#334155',
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    accentColor: '#6366F1',
    tabBarBackground: '#1E293B',
    tabBarActiveColor: '#6366F1',
    tabBarInactiveColor: '#94A3B8',
    inputBackground: '#0F172A',
    buttonTextColor: '#FFFFFF',
    dangerColor: '#EF4444',
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
