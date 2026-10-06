import { useCallback } from 'react';
import { Account, Status } from '../services/mastodon/types';
import { useNavigator } from '../services/navigationContext';
import { useI18n } from '../services/i18n/i18nContext';
import { useBlockAccount, useMuteAccount, useUnblockAccount, useUnmuteAccount } from './useRelationships';
import { dialog } from '../services/dialog';

// Report, mute and block, as offered from posts and profiles. Blocking asks first; the rest
// say when they're done (or that they failed).
export const useModeration = () => {
    const { t } = useI18n();
    const { push } = useNavigator();
    const blockAccount = useBlockAccount();
    const unblockAccount = useUnblockAccount();
    const muteAccount = useMuteAccount();
    const unmuteAccount = useUnmuteAccount();

    const run = useCallback(async (change: () => Promise<unknown>, done?: string) => {
        try {
            await change();
            if (done) dialog.toast(done);
        } catch (error) {
            console.warn('Moderation action failed:', error);
            dialog.toast(t('moderation.failed'));
        }
    }, [t]);

    const report = useCallback((account: Account, status?: Status) => push({ name: 'report', account, status }), [push]);

    const mute = useCallback(
        (account: Account) => run(() => muteAccount(account.id), t('moderation.muted', { acct: account.acct })),
        [run, muteAccount, t]
    );
    const unmute = useCallback((account: Account) => run(() => unmuteAccount(account.id)), [run, unmuteAccount]);

    const block = useCallback(
        (account: Account) =>
            dialog.alert(t('moderation.blockTitle'), t('moderation.blockMessage'), [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('moderation.block'),
                    style: 'destructive',
                    onPress: () => run(() => blockAccount(account.id), t('moderation.blocked', { acct: account.acct })),
                },
            ], { subtitle: `@${account.acct}` }),
        [run, blockAccount, t]
    );
    const unblock = useCallback((account: Account) => run(() => unblockAccount(account.id)), [run, unblockAccount]);

    return { report, mute, unmute, block, unblock };
};
