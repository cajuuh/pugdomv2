import React from 'react';
import { Linking, Text } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { openLink, setExternalBrowser } from '../services/links';
import { EXTERNAL_BROWSER_KEY, SettingsProvider, useSettings } from '../services/settingsContext';

jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn().mockResolvedValue({}) }));

beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    setExternalBrowser(false);
    await AsyncStorage.clear();
});

describe('Opening links', () => {
    it("opens in the in-app browser, or the phone's browser when chosen", async () => {
        await openLink('https://pug.news/a');
        expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://pug.news/a');
        expect(Linking.openURL).not.toHaveBeenCalled();

        setExternalBrowser(true);
        await openLink('https://pug.news/b');
        expect(Linking.openURL).toHaveBeenCalledWith('https://pug.news/b');
        expect(WebBrowser.openBrowserAsync).toHaveBeenCalledTimes(1);
    });

    it('remembers the choice, and applies it when the app starts', async () => {
        const Probe = () => {
            const { externalBrowser, setExternalBrowser: choose } = useSettings();
            return <Text onPress={() => choose(true)}>{externalBrowser ? 'external' : 'in-app'}</Text>;
        };
        await render(<SettingsProvider><Probe /></SettingsProvider>);
        await fireEvent.press(await screen.findByText('in-app'));
        expect(await screen.findByText('external')).toBeTruthy();
        expect(await AsyncStorage.getItem(EXTERNAL_BROWSER_KEY)).toBe('true');

        // Next start: read back before any link is opened
        setExternalBrowser(false);
        await render(<SettingsProvider><Probe /></SettingsProvider>);
        expect(await screen.findByText('external')).toBeTruthy();
        await openLink('https://pug.news/c');
        await waitFor(() => expect(Linking.openURL).toHaveBeenCalledWith('https://pug.news/c'));
    });
});
