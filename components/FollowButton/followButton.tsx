import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRecyclingState } from '@shopify/flash-list';
import { PillButton } from '../ui';
import { Relationship } from '../../services/mastodon/types';
import { useFollowAccount, useUnfollowAccount } from '../../hooks/useRelationships';
import { useI18n } from '../../services/i18n/i18nContext';
import { useTheme } from '../../services/themeContext';
import { radii, space } from '../../services/theme/shape';
import { dialog } from '../../services/dialog';

interface FollowButtonProps {
    accountId: string;
    // For the confirmation before unfollowing
    name: string;
    relationship?: Relationship;
    // Profiles let you unfollow or cancel a request; notification rows only show the state
    allowUnfollow?: boolean;
    size?: 'small' | 'medium';
}

export const FollowButton: React.FC<FollowButtonProps> = ({ accountId, name, relationship, allowUnfollow = false, size = 'small' }) => {
    const { colors, type } = useTheme();
    const { t } = useI18n();
    const follow = useFollowAccount();
    const unfollow = useUnfollowAccount();
    // Lists recycle rows, so reset when the button shows another account
    const [pending, setPending] = useRecyclingState(false, [accountId]);

    // Hide until the relationship is known, so we never offer to follow someone we already follow
    if (!relationship) {
        return null;
    }

    const run = async (change: (id: string) => Promise<unknown>, failed: string) => {
        setPending(true);
        try {
            await change(accountId);
        } catch {
            dialog.toast(failed);
        } finally {
            setPending(false);
        }
    };

    if (relationship.following || relationship.requested) {
        // Locked accounts approve follows first, so a follow sent to them stays "Requested"
        const label = relationship.following ? t('follow.following') : t('follow.requested');
        if (!allowUnfollow) {
            return (
                <View style={[styles.state, { backgroundColor: colors.accentSoft }]} accessible accessibilityLabel={label}>
                    <Ionicons name={relationship.following ? 'checkmark' : 'time-outline'} size={15} color={colors.accentText} />
                    <Text style={[type.name, styles.stateText, { color: colors.accentText }]}>{label}</Text>
                </View>
            );
        }
        const confirm = () =>
            dialog.alert(
                relationship.following ? t('follow.unfollowTitle') : t('follow.cancelRequestTitle'),
                undefined,
                [
                    { text: t('follow.keep'), style: 'cancel' },
                    {
                        text: relationship.following ? t('follow.unfollow') : t('follow.cancelRequest'),
                        style: 'destructive',
                        onPress: () => run(unfollow, t('follow.unfollowFailed')),
                    },
                ],
                { subtitle: name }
            );
        return (
            <PillButton
                label={label}
                icon={relationship.following ? 'checkmark' : 'time-outline'}
                variant="secondary"
                size={size}
                disabled={pending}
                onPress={confirm}
            />
        );
    }

    return (
        <PillButton
            label={pending ? t('follow.pending') : relationship.followed_by ? t('follow.followBack') : t('follow.follow')}
            size={size}
            disabled={pending}
            onPress={() => run(follow, t('follow.failed'))}
        />
    );
};

const styles = StyleSheet.create({
    state: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        height: 34,
        paddingHorizontal: space.md,
        borderRadius: radii.pill,
    },
    stateText: {
        fontSize: 13,
    },
});
