import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text } from 'react-native';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { ThemeProvider, useTheme } from '../services/themeContext';
import { buildColors } from '../services/theme/coats';
import { buildType } from '../services/theme/typography';

// Settings live in AsyncStorage (jest.setup.js mock); SecureStore only holds settings saved by builds before 1.1.0
const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
    getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
        mockStore.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
        mockStore.delete(key);
    }),
}));

let mockFontState: [boolean, Error | null] = [true, null];
jest.mock('expo-font', () => ({
    useFonts: () => mockFontState,
}));

let theme: ReturnType<typeof useTheme>;

const Probe = () => {
    theme = useTheme();
    return <Text>{`${theme.coat}:${theme.tint}`}</Text>;
};

const renderTheme = async (expected: string) => {
    const view = await render(
        <ThemeProvider>
            <Probe />
        </ThemeProvider>
    );
    await waitFor(() => expect(screen.getByText(expected)).toBeTruthy());
    return view;
};

beforeEach(async () => {
    mockStore.clear();
    await AsyncStorage.clear();
    mockFontState = [true, null];
});

describe('ThemeProvider', () => {
    it('defaults to the Apricot coat with the tint on', async () => {
        await renderTheme('apricot:true');
        expect(theme.colors).toEqual(buildColors('apricot', theme.isDark, true));
    });

    it('persists the coat and tint across restarts', async () => {
        const first = await renderTheme('apricot:true');
        await act(async () => {
            await theme.setCoat('sage');
            await theme.setTint(false);
        });
        expect(screen.getByText('sage:false')).toBeTruthy();
        expect(theme.colors).toEqual(buildColors('sage', theme.isDark, false));
        await first.unmount();

        await renderTheme('sage:false');
        expect(theme.colors).toEqual(buildColors('sage', theme.isDark, false));
    });

    it('falls back to Apricot when the stored coat is unknown', async () => {
        await AsyncStorage.setItem('pugdom_settings_coat', 'corgi');
        await AsyncStorage.setItem('pugdom_settings_tint', 'false');
        await renderTheme('apricot:false');
    });

    it('exposes the brand type scale once the fonts load', async () => {
        await renderTheme('apricot:true');
        expect(theme.fontsReady).toBe(true);
        expect(theme.type).toEqual(buildType(true));
    });

    it('holds the app while the fonts load', async () => {
        mockFontState = [false, null];
        await renderTheme('apricot:true');
        expect(theme.fontsReady).toBe(false);
    });

    it('falls back to the system font when the fonts fail to load', async () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        mockFontState = [false, new Error('font file missing')];
        await renderTheme('apricot:true');
        expect(theme.fontsReady).toBe(true);
        expect(theme.type).toEqual(buildType(false));
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });
});
