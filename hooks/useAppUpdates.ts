import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as Updates from 'expo-updates';
import { dialog } from '../services/dialog';
import { useI18n } from '../services/i18n/i18nContext';

// Store builds download updates in the background, and they only apply on the next cold start, which on
// Android can be days away. This also checks whenever the app comes back to the foreground, and once an update
// is downloaded, offers to restart into it (asking first: a restart would lose a post being written).
export const useAppUpdates = () => {
    const { t } = useI18n();
    const { isUpdatePending, downloadedUpdate } = Updates.useUpdates();

    useEffect(() => {
        if (!Updates.isEnabled) return;
        const subscription = AppState.addEventListener('change', async state => {
            if (state !== 'active') return;
            try {
                const { isAvailable } = await Updates.checkForUpdateAsync();
                if (isAvailable) await Updates.fetchUpdateAsync();
            } catch (error) {
                console.warn('Checking for an update failed:', error);
            }
        });
        return () => subscription.remove();
    }, []);

    useEffect(() => {
        if (!isUpdatePending) return;
        dialog.alert(t('updates.readyTitle'), t('updates.readyMessage'), [
            { text: t('updates.later'), style: 'cancel' },
            { text: t('updates.restart'), onPress: () => Updates.reloadAsync().catch(error => console.warn('Restarting failed:', error)) },
        ]);
        // Once per downloaded update
    }, [isUpdatePending, downloadedUpdate?.updateId]);
};
