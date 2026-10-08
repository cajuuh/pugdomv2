import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { TabBar } from '../components/TabBar/tabBar';
import { TAB_BAR_CLEARANCE, DOCK_HEIGHT, DOCK_BOTTOM_OFFSET, dockBottomOffset } from '../components/TabBar/styles';
import { TopBar } from '../components/TopBar/topBar';
import { mockTheme } from '../testUtils/theme';
import { Account } from '../services/mastodon/types';

jest.mock('../services/themeContext', () => ({
    useTheme: () => jest.requireActual('../testUtils/theme').mockTheme,
}));

const { colors } = mockTheme;

describe('TabBar', () => {
    const renderDock = async (activeTab: 'home' | 'notifications' = 'home') => {
        const onTabPress = jest.fn();
        const onComposePress = jest.fn();
        await render(<TabBar activeTab={activeTab} onTabPress={onTabPress} onComposePress={onComposePress} />);
        return { onTabPress, onComposePress };
    };

    it('labels every tab and marks the active one with a soft pill', async () => {
        await renderDock('notifications');

        for (const name of ['Home', 'Search', 'Notifications', 'Profile']) {
            expect(screen.getByRole('tab', { name })).toBeTruthy();
        }
        const active = screen.getByRole('tab', { name: 'Notifications' });
        expect(active).toBeSelected();
        expect(StyleSheet.flatten(active.props.style).backgroundColor).toBe(colors.accentSoft);
        expect(screen.getByRole('tab', { name: 'Home' })).not.toBeSelected();
        expect(StyleSheet.flatten(screen.getByRole('tab', { name: 'Home' }).props.style).backgroundColor).toBeUndefined();
    });

    it('switches tabs and opens compose from inside the dock', async () => {
        const { onTabPress, onComposePress } = await renderDock();

        await fireEvent.press(screen.getByRole('tab', { name: 'Search' }));
        expect(onTabPress).toHaveBeenCalledWith('search');

        await fireEvent.press(screen.getByRole('button', { name: 'New post' }));
        expect(onComposePress).toHaveBeenCalled();
    });

    it('keeps tab screens scrollable past the dock', () => {
        expect(TAB_BAR_CLEARANCE).toBeGreaterThan(DOCK_HEIGHT + DOCK_BOTTOM_OFFSET);
    });
});

describe('TopBar', () => {
    const user = { id: '1', username: 'pug', acct: 'pug', display_name: 'Pug Dom', avatar: '', emojis: [] } as Account;

    const renderHeader = async (unreadMessages = false) => {
        const handlers = { onProfilePress: jest.fn(), onSettingsPress: jest.fn(), onLogoutPress: jest.fn(), onMessagesPress: jest.fn() };
        await render(<TopBar user={user} unreadMessages={unreadMessages} {...handlers} />);
        return handlers;
    };

    it('opens messages from the envelope, with a dot when some are unread', async () => {
        const { onMessagesPress } = await renderHeader();
        expect(screen.queryByTestId('messages-dot')).toBeNull();
        await fireEvent.press(screen.getByRole('button', { name: 'Messages' }));
        expect(onMessagesPress).toHaveBeenCalled();

        await renderHeader(true);
        expect(screen.getByTestId('messages-dot')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Messages, unread' })).toBeTruthy();
    });

    it('shows the wordmark and opens settings from its own button', async () => {
        const { onSettingsPress } = await renderHeader();

        expect(screen.getByRole('header', { name: 'pugdon' })).toBeTruthy();
        await fireEvent.press(screen.getByRole('button', { name: 'Settings' }));
        expect(onSettingsPress).toHaveBeenCalled();
    });

    it('opens the account menu from the avatar', async () => {
        const { onProfilePress, onLogoutPress } = await renderHeader();

        await fireEvent.press(screen.getByRole('button', { name: 'Account menu' }));
        await fireEvent.press(screen.getByRole('button', { name: 'Profile' }));
        expect(onProfilePress).toHaveBeenCalled();

        await fireEvent.press(screen.getByRole('button', { name: 'Account menu' }));
        await fireEvent.press(screen.getByRole('button', { name: 'Log Out' }));
        expect(onLogoutPress).toHaveBeenCalled();
    });
});

describe('dockBottomOffset', () => {
    it('lifts the dock above a tall Android navigation bar, and keeps the usual gap otherwise', () => {
        // 3-button navigation
        expect(dockBottomOffset('android', 48)).toBe(56);
        // Gestures, or no navigation bar
        expect(dockBottomOffset('android', 0)).toBe(20);
        expect(dockBottomOffset('android', 12)).toBe(20);
        // iOS's home indicator fits the fixed offset
        expect(dockBottomOffset('ios', 34)).toBe(28);
    });
});
