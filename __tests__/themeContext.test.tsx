import React from 'react';
import { Text } from 'react-native';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { ThemeProvider, useTheme } from '../services/themeContext';
import { buildColors } from '../services/theme/coats';

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

beforeEach(() => mockStore.clear());

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
        mockStore.set('pugdom_settings_coat', 'corgi');
        mockStore.set('pugdom_settings_tint', 'false');
        await renderTheme('apricot:false');
    });
});
