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
    background: '#F4F3EF',
    cardBackground: '#FFFFFF',
    borderColor: '#E3E1D5',
    textPrimary: '#2D3748',
    textSecondary: '#4A5568',
    textMuted: '#718096',
    accentColor: '#556B2F',
    tabBarBackground: '#F4F3EF',
    tabBarActiveColor: '#556B2F',
    tabBarInactiveColor: '#A3B18A',
    inputBackground: '#EAE8DE',
    buttonTextColor: '#FFFFFF',
    dangerColor: '#E63946',
    warningColor: '#FFB703',
};

export const darkColors: ThemeColors = {
    background: '#0F0E17',
    cardBackground: '#1E1B2E',
    borderColor: '#2A263D',
    textPrimary: '#F4F3EF',
    textSecondary: '#A3B18A',
    textMuted: '#6B7280',
    accentColor: '#A3B18A',
    tabBarBackground: '#0F0E17',
    tabBarActiveColor: '#A3B18A',
    tabBarInactiveColor: '#4A5568',
    inputBackground: '#1E1B2E',
    buttonTextColor: '#0F0E17',
    dangerColor: '#E63946',
    warningColor: '#FFB703',
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
