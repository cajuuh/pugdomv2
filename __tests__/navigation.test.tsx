import React from 'react';
import { BackHandler, DeviceEventEmitter } from 'react-native';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
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
        useOptionalAuth: () => auth,
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
jest.mock('../screens/Settings/settings', () => ({ onBack }: { onBack: () => void }) => {
    const { Pressable, Text } = require('react-native');
    return (
        <Pressable accessibilityRole="button" accessibilityLabel="Close settings" onPress={onBack}>
            <Text>Settings screen</Text>
        </Pressable>
    );
});
// A thread shows its id, can open a reply (post id + 1) and go back
jest.mock('../screens/Thread/thread', () => ({ statusId, onBack, onStatusPress }: { statusId: string; onBack: () => void; onStatusPress: (id: string) => void }) => {
    const { Pressable, Text, View } = require('react-native');
    return (
        <View>
            <Text>Thread {statusId}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Open reply" onPress={() => onStatusPress(String(Number(statusId) + 1))} />
            <Pressable accessibilityRole="button" accessibilityLabel="Reopen this post" onPress={() => onStatusPress(statusId)} />
            <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} />
        </View>
    );
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
        expect(screen.getByText('Thread 42')).toBeTruthy();

        await fireEvent.press(screen.getByRole('tab', { name: 'Search' }));

        expect(screen.queryByText('Thread 42')).toBeNull();
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

    describe('screen stack', () => {
        // The listener App registers for Android's back button
        let backPress: (() => boolean | null | undefined) | undefined;
        beforeEach(() => {
            jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_, handler) => {
                backPress = handler;
                return { remove: jest.fn() } as any;
            });
        });
        afterEach(() => jest.restoreAllMocks());

        const openPost = async () => {
            await render(<App />);
            await fireEvent.press(await screen.findByRole('button', { name: 'Open post' }));
        };

        it('opens a post from a thread on top, and the header arrow goes back to the tabs', async () => {
            await openPost();
            await fireEvent.press(screen.getByRole('button', { name: 'Open reply' }));
            expect(screen.getByText('Thread 43')).toBeTruthy();
            // The thread below stays mounted but hidden
            expect(screen.queryByText('Thread 42')).toBeNull();

            await fireEvent.press(screen.getByRole('button', { name: 'Back' }));

            expect(screen.getByText('Home screen')).toBeTruthy();
            expect(screen.queryByText('Thread 42')).toBeNull();
        });

        it('does not stack the same post twice', async () => {
            await openPost();
            await fireEvent.press(screen.getByRole('button', { name: 'Reopen this post' }));

            await act(async () => {
                backPress?.();
            });

            expect(screen.getByText('Home screen')).toBeTruthy();
        });

        it("closes the top screen with Android's back button, and lets it leave the app when nothing is open", async () => {
            await openPost();
            await fireEvent.press(screen.getByRole('button', { name: 'Open reply' }));

            await act(async () => {
                expect(backPress?.()).toBe(true);
            });
            expect(screen.getByText('Thread 42')).toBeTruthy();

            await act(async () => {
                expect(backPress?.()).toBe(true);
            });
            expect(screen.getByText('Home screen')).toBeTruthy();
            expect(backPress?.()).toBe(false);
        });

        it('hides the tabs from screen readers while a post is open over them', async () => {
            await openPost();

            // The top bar and timeline are under the post, so they can't be reached
            expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull();
            expect(screen.queryByText('Home screen')).toBeNull();
            // The dock stays on top and usable
            expect(screen.getByRole('tab', { name: 'Home' })).toBeTruthy();
        });

        it('closes Settings with its back arrow', async () => {
            await render(<App />);
            await fireEvent.press(await screen.findByRole('button', { name: 'Settings' }));

            await fireEvent.press(screen.getByRole('button', { name: 'Close settings' }));

            expect(screen.getByText('Home screen')).toBeTruthy();
        });
    });
});
describe('pushRoute', () => {
    const { pushRoute, MAX_STACK_DEPTH } = jest.requireActual('../services/navigationContext');
    const thread = (statusId: string) => ({ name: 'thread', statusId });

    it('adds a screen on top unless it is already the top one', () => {
        const one = pushRoute([], thread('1'), 'a');
        expect(one).toEqual([{ key: 'a', route: thread('1') }]);
        expect(pushRoute(one, thread('1'), 'b')).toBe(one);
        expect(pushRoute(one, thread('2'), 'b')).toHaveLength(2);
    });

    it('drops the oldest screen past the limit', () => {
        let stack: any[] = [];
        for (let i = 0; i < MAX_STACK_DEPTH + 3; i++) stack = pushRoute(stack, thread(String(i)), `k${i}`);

        expect(stack).toHaveLength(MAX_STACK_DEPTH);
        expect(stack[0].route).toEqual(thread('3'));
        expect(stack[stack.length - 1].route).toEqual(thread(String(MAX_STACK_DEPTH + 2)));
    });
});
