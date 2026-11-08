import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

// Links open in the in-app browser, or in the phone's own browser when that's switched on in Settings.
// Module state, set by the settings, so openLink stays the same function for StatusHtmlContent's memo.
let externalBrowser = false;
export const setExternalBrowser = (value: boolean) => {
    externalBrowser = value;
};

export const openLink = async (url: string) => {
    try {
        await (externalBrowser ? Linking.openURL(url) : WebBrowser.openBrowserAsync(url));
    } catch (error) {
        console.error('Failed to open link:', error);
    }
};
