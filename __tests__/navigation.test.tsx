import React from 'react';
import { DeviceEventEmitter } from 'react-native';
import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import App from '../App';
import { queryClient } from '../services/queryClient';
import { TAB_BAR_CLEARANCE } from '../components/TabBar/styles';
import { makeAppearanceStyles, makeStyles as makeSettingsStyles } from '../screens/Settings/styles';
import { mockTheme } from '../testUtils/theme';

jest.mock('expo-splash-screen', () => ({
    preventAutoHideAsync: jest.fn(async () => true),
    hideAsync: jest.fn(async () => {}),
}));

// Signed in; the screens are stand-ins so only the navigation in App.tsx is exercised
jest.mock('../services/authContext', () => {
    const user = { id: '1', username: 'pug', acct: 'pug', display_name: 'Pug', avatar: '' };
    const auth = {
        user,
        loading: false,
        logout: jest.fn(),
        isAddingAccount: false,
        setAddingAccount: jest.fn(),
        savedAccounts: [],
        switchAccount: jest.fn(),
    };
    return {
        AuthProvider: ({ children }: { children: React.ReactNode }) => children,
        useAuth: () => auth,
    };
});

jest.mock('../services/storage', () => ({
    getCredentials: jest.fn(async () => ({ accessToken: 'token', instanceUrl: 'https://pug.social' })),
    getSetting: jest.fn(async (_key: string, fallback: boolean) => fallback),
    saveSetting: jest.fn(),
    getStringSetting: jest.fn(async (_key: string, fallback: string) => fallback),
    saveStringSetting: jest.fn(),
}));

jest.mock('../components/TopBar/topBar', () => {
    const { Pressable, Text } = require('react-native');
    return {
        TopBar: ({ onSettingsPress }: { onSettingsPress: () => void }) => (
            <Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={onSettingsPress}>
                <Text>Top bar</Text>
            </Pressable>
        ),
    };
});

jest.mock('../screens/Timeline/timeline', () => {
    const { Pressable, Text } = require('react-native');
    return ({ onStatusPress }: { onStatusPress: (id: string) => void }) => (
        <Pressable accessibilityRole="button" accessibilityLabel="Open post" onPress={() => onStatusPress('42')}>
            <Text>Home screen</Text>
        </Pressable>
    );
});
jest.mock('../screens/Search/search', () => () => {
    const { Text } = require('react-native');
    return <Text>Search screen</Text>;
});
jest.mock('../screens/Notifications/notifications', () => () => {
    const { Text } = require('react-native');
    return <Text>Notifications screen</Text>;
});
jest.mock('../screens/Profile/profile', () => () => {
    const { Text } = require('react-native');
    return <Text>Profile screen</Text>;
});
jest.mock('../screens/Settings/settings', () => () => {
    const { Text } = require('react-native');
    return <Text>Settings screen</Text>;
});
jest.mock('../screens/Thread/thread', () => () => {
    const { Text } = require('react-native');
    return <Text>Thread screen</Text>;
});

const openSettings = async () => {
    await render(<App />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Settings' }));
    expect(screen.getByText('Settings screen')).toBeTruthy();
};

describe('App navigation', () => {
    afterEach(async () => {
        await cleanup();
        queryClient.clear();
    });

    it.each([
        ['Search', 'Search screen'],
        ['Notifications', 'Notifications screen'],
        ['Profile', 'Profile screen'],
    ])('closes Settings when the %s tab is pressed', async (tab, screenText) => {
        await openSettings();

        await fireEvent.press(screen.getByRole('tab', { name: tab }));

        expect(screen.queryByText('Settings screen')).toBeNull();
        expect(screen.getByText(screenText)).toBeTruthy();
    });

    it('closes Settings on Home without scrolling the timeline', async () => {
        const emit = jest.spyOn(DeviceEventEmitter, 'emit');
        await openSettings();

        await fireEvent.press(screen.getByRole('tab', { name: 'Home' }));

        expect(screen.queryByText('Settings screen')).toBeNull();
        expect(screen.getByText('Home screen')).toBeTruthy();
        expect(emit).not.toHaveBeenCalledWith('scroll_to_top_home');
        emit.mockRestore();
    });

    it('closes a thread when a tab is pressed', async () => {
        await render(<App />);
        await fireEvent.press(await screen.findByRole('button', { name: 'Open post' }));
        expect(screen.getByText('Thread screen')).toBeTruthy();

        await fireEvent.press(screen.getByRole('tab', { name: 'Search' }));

        expect(screen.queryByText('Thread screen')).toBeNull();
        expect(screen.getByText('Search screen')).toBeTruthy();
    });

    it('still scrolls to the top when Home is pressed on Home', async () => {
        const emit = jest.spyOn(DeviceEventEmitter, 'emit');
        await render(<App />);
        await screen.findByText('Home screen');

        await fireEvent.press(screen.getByRole('tab', { name: 'Home' }));

        expect(emit).toHaveBeenCalledWith('scroll_to_top_home');
        emit.mockRestore();
    });
});

describe('Settings dock clearance', () => {
    // The dock floats over Settings, so the last rows (e.g. "Tint surfaces with coat") must scroll clear of it
    it('pads Settings and Appearance by the dock height', () => {
        expect(makeSettingsStyles(mockTheme.colors).contentContainer.paddingBottom).toBeGreaterThanOrEqual(TAB_BAR_CLEARANCE);
        expect(makeAppearanceStyles(mockTheme.colors).content.paddingBottom).toBeGreaterThanOrEqual(TAB_BAR_CLEARANCE);
    });
});
