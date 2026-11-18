import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as Updates from 'expo-updates';
import { dialog } from '../services/dialog';
import { useI18n } from '../services/i18n/i18nContext';
import { Translator } from '../services/i18n/translate';
import { useOptionalSettings } from '../services/settingsContext';

// Builds from 1.3.5 leave every check to the app (checkAutomatically NEVER), so turning automatic updates off
// means off. Older builds download at launch on their own, whatever the setting says.
export const appChecksAtLaunch = () => Updates.checkAutomatically === 'NEVER';

// Shows Settings' updates rows: off in the F-Droid build, which has no over-the-air updates
export const updatesAvailable = () => Updates.isEnabled || __DEV__;

// Asking first: a restart would lose a post being written. Once per downloaded update, whichever path
// (the automatic check or Check for updates) got there first.
const offered = new Set<string>();
const offerRestart = (t: Translator['t'], updateId?: string) => {
    if (updateId && offered.has(updateId)) return;
    if (updateId) offered.add(updateId);
    dialog.alert(t('updates.readyTitle'), t('updates.readyMessage'), [
        { text: t('updates.later'), style: 'cancel' },
        { text: t('updates.restart'), onPress: () => Updates.reloadAsync().catch(error => console.warn('Restarting failed:', error)) },
    ]);
};

const downloadIfNew = async () => {
    const { isAvailable } = await Updates.checkForUpdateAsync();
    if (isAvailable) await Updates.fetchUpdateAsync();
};

// Settings' Check for updates, which works with automatic updates on or off
export const checkForUpdate = async (t: Translator['t']) => {
    dialog.toast(t('updates.checking'));
    try {
        const { isAvailable } = await Updates.checkForUpdateAsync();
        if (!isAvailable) {
            dialog.toast(t('updates.upToDate'));
            return;
        }
        dialog.toast(t('updates.downloading'));
        const fetched = await Updates.fetchUpdateAsync();
        offerRestart(t, fetched.manifest?.id);
    } catch (error) {
        console.warn('Checking for an update failed:', error);
        dialog.toast(t('updates.checkFailed'));
    }
};

// With automatic updates on (the default): store builds download updates in the background, and they only apply
// on the next cold start, which on Android can be days away. This also checks whenever the app comes back to
// the foreground, and once an update is downloaded, offers to restart into it. A toast says when one starts
// downloading, so it doesn't arrive unannounced. Off, it does none of this: Settings has Check for updates.
export const useAppUpdates = () => {
    const { t } = useI18n();
    const settings = useOptionalSettings();
    // Wait for the saved setting, or "off" would read as the default "on" for a moment
    const automatic = (!settings || !settings.loadingSettings) && (settings?.autoUpdates ?? true);
    const { isDownloading, isUpdatePending, downloadedUpdate } = Updates.useUpdates();

    // ponytail: a toast (3s), no progress bar; the Update ready dialog follows when it's done
    useEffect(() => {
        if (isDownloading && automatic) dialog.toast(t('updates.downloading'));
    }, [isDownloading]);

    useEffect(() => {
        if (!Updates.isEnabled || !automatic) return;
        const check = () => downloadIfNew().catch(error => console.warn('Checking for an update failed:', error));
        if (appChecksAtLaunch()) check();
        const subscription = AppState.addEventListener('change', state => {
            if (state === 'active') check();
        });
        return () => subscription.remove();
    }, [automatic]);

    useEffect(() => {
        if (isUpdatePending && automatic) offerRestart(t, downloadedUpdate?.updateId);
    }, [isUpdatePending, downloadedUpdate?.updateId, automatic]);
};
