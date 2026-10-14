import { useCallback } from 'react';
import { Platform } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { deleteStatus, pinStatus, unpinStatus } from '../services/mastodon/statuses';
import { Status } from '../services/mastodon/types';
import { useCompose } from '../services/composeContext';
import { useI18n } from '../services/i18n/i18nContext';
import { useRemoveCachedStatus, useUpdateCachedStatus } from './useUpdateCachedStatus';
import { accountStatusesKey } from './useAccountStatuses';
import { dialog } from '../services/dialog';

// iOS can't present the compose modal while the menu's own modal is still closing
const afterMenu = (open: () => void) => setTimeout(open, Platform.OS === 'ios' ? 400 : 0);

// Edit, pin, delete, and delete-and-redraft one of your own posts. Deleting asks first.
export const usePostActions = () => {
    const { t } = useI18n();
    const { openCompose } = useCompose();
    const removeCachedStatus = useRemoveCachedStatus();
    const updateCachedStatus = useUpdateCachedStatus();
    const queryClient = useQueryClient();

    const edit = useCallback((status: Status) => afterMenu(() => openCompose({ existingPost: { mode: 'edit', status } })), [openCompose]);

    // Pins it to the top of your profile, or takes it off
    const togglePin = useCallback(async (status: Status) => {
        try {
            const updated = await (status.pinned ? unpinStatus : pinStatus)(status.id);
            updateCachedStatus(updated);
            queryClient.invalidateQueries({ queryKey: accountStatusesKey(status.account.id, 'pinned') });
            dialog.toast(t(updated.pinned ? 'posts.pinDone' : 'posts.unpinDone'));
        } catch (error: any) {
            console.warn('Pin failed:', error);
            // Mastodon says why (most often: the most posts you can pin are already pinned)
            const reason = error?.response?.data?.error;
            dialog.toast(reason ? t('posts.pinFailedBecause', { reason }) : t('posts.pinFailed'));
        }
    }, [queryClient, t, updateCachedStatus]);

    const deleteNow = useCallback(async (status: Status) => {
        try {
            const deleted = await deleteStatus(status.id);
            removeCachedStatus(status.id);
            return deleted;
        } catch (error) {
            console.warn('Delete failed:', error);
            dialog.toast(t('posts.deleteFailed'));
            return null;
        }
    }, [removeCachedStatus, t]);

    const remove = useCallback(
        (status: Status) =>
            dialog.alert(t('posts.deleteTitle'), t('posts.deleteMessage'), [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('posts.delete'), style: 'destructive', onPress: () => deleteNow(status) },
            ]),
        [deleteNow, t]
    );

    // The delete's answer carries the source text; the post's images stay reusable for a while
    const redraft = useCallback(
        (status: Status) =>
            dialog.alert(t('posts.redraftTitle'), t('posts.redraftMessage'), [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('posts.redraft'),
                    style: 'destructive',
                    onPress: async () => {
                        const deleted = await deleteNow(status);
                        if (deleted) afterMenu(() => openCompose({ existingPost: { mode: 'redraft', status: { ...status, ...deleted } } }));
                    },
                },
            ]),
        [deleteNow, openCompose, t]
    );

    return { edit, togglePin, remove, redraft };
};
