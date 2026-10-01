import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import Settings from '../screens/Settings/settings';
import { ThemeProvider } from '../services/themeContext';

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
jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: () => [true, null] }));
jest.mock('../services/authContext', () => ({
    useAuth: () => ({
        user: { id: '1' },
        logout: jest.fn(),
        savedAccounts: [{
            id: 'pug@https://pug.town',
            instanceUrl: 'https://pug.town',
            accessToken: 'token',
            userInfo: { id: '1', username: 'pug', display_name: 'Pug', avatar: '', acct: 'pug' },
        }],
        switchAccount: jest.fn(),
        setAddingAccount: jest.fn(),
    }),
}));
jest.mock('../services/settingsContext', () => ({
    useSettings: () => ({
        notifications: true,
        setNotifications: jest.fn(),
        mediaAutoplay: false,
        setMediaAutoplay: jest.fn(),
        compactMode: false,
        setCompactMode: jest.fn(),
    }),
}));

const renderAppearance = async () => {
    await render(
        <ThemeProvider>
            <Settings onBack={jest.fn()} />
        </ThemeProvider>
    );
    await fireEvent.press(await screen.findByRole('button', { name: 'Appearance, Apricot' }));
    await screen.findByRole('radio', { name: 'Apricot' });
};

beforeEach(async () => {
    mockStore.clear();
    await AsyncStorage.clear();
});

describe('Appearance settings', () => {
    it('opens from Settings and goes back', async () => {
        await renderAppearance();
        expect(screen.getByRole('radio', { name: 'Apricot' })).toBeChecked();
        expect(screen.getAllByRole('radio')).toHaveLength(9);
        expect(screen.getByLabelText('Preview of the Apricot coat')).toBeTruthy();

        await fireEvent.press(screen.getByRole('button', { name: 'Back to settings' }));
        expect(await screen.findByRole('button', { name: 'Appearance, Apricot' })).toBeTruthy();
    });

    it('applies and saves the picked coat', async () => {
        await renderAppearance();

        await fireEvent.press(screen.getByRole('radio', { name: 'Sage' }));

        expect(screen.getByRole('radio', { name: 'Sage' })).toBeChecked();
        expect(screen.getByRole('radio', { name: 'Apricot' })).not.toBeChecked();
        expect(screen.getByLabelText('Preview of the Sage coat')).toBeTruthy();
        await waitFor(async () => expect(await AsyncStorage.getItem('pugdom_settings_coat')).toBe('sage'));

        await fireEvent.press(screen.getByRole('button', { name: 'Back to settings' }));
        expect(await screen.findByRole('button', { name: 'Appearance, Sage' })).toBeTruthy();
    });

    it('switches and saves the mode', async () => {
        await renderAppearance();
        expect(screen.getByRole('tab', { name: 'System' })).toBeSelected();

        await fireEvent.press(screen.getByRole('tab', { name: 'Dark' }));

        expect(screen.getByRole('tab', { name: 'Dark' })).toBeSelected();
        await waitFor(async () => expect(await AsyncStorage.getItem('pugdom_settings_theme')).toBe('dark'));
    });

    it('turns the surface tint off and saves it', async () => {
        await renderAppearance();
        const tint = screen.getByRole('switch', { name: 'Tint surfaces with coat' });
        expect(tint).toBeChecked();

        await fireEvent(tint, 'valueChange', false);

        expect(screen.getByRole('switch', { name: 'Tint surfaces with coat' })).not.toBeChecked();
        await waitFor(async () => expect(await AsyncStorage.getItem('pugdom_settings_tint')).toBe('false'));
    });
});
