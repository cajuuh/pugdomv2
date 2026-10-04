import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../ui';
import { FollowButton } from '../FollowButton/followButton';
import { Account, Relationship } from '../../services/mastodon/types';
import { renderTextWithEmojis } from '../../services/emojiHelper';
import { useOpenAccount } from '../../hooks/useOpenAccount';
import { useI18n } from '../../services/i18n/i18nContext';
import { useTheme } from '../../services/themeContext';
import { space } from '../../services/theme/shape';

interface AccountRowProps {
    account: Account;
    relationship?: Relationship;
    // Your own account has no follow button
    isSelf?: boolean;
}

// A person in a list: avatar, name, handle and a follow button; the row opens their profile
export const AccountRow: React.FC<AccountRowProps> = ({ account, relationship, isSelf }) => {
    const { colors, type } = useTheme();
    const { t } = useI18n();
    const { openAccount } = useOpenAccount();
    const name = account.display_name || account.username;

    return (
        <View style={styles.row}>
            <Pressable
                onPress={() => openAccount(account)}
                accessibilityRole="link"
                accessibilityLabel={t('post.openProfile', { name })}
                style={({ pressed }) => [styles.person, pressed && { opacity: 0.7 }]}
            >
                <Avatar name={name} uri={account.avatar} size={44} />
                <View style={styles.names}>
                    <Text style={[type.name, { color: colors.textPrimary }]} numberOfLines={1}>
                        {renderTextWithEmojis(name, account.emojis || [], [type.name, { color: colors.textPrimary }], 16)}
                    </Text>
                    <Text style={[type.meta, { color: colors.textMuted }]} numberOfLines={1}>@{account.acct}</Text>
                </View>
            </Pressable>
            {!isSelf && <FollowButton accountId={account.id} name={name} relationship={relationship} allowUnfollow />}
        </View>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: space.sm,
        paddingHorizontal: space.lg,
    },
    person: {
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
    },
    names: {
        flex: 1,
        minWidth: 0,
    },
});
