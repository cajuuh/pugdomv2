import React from 'react';
import { Alert, Image, Pressable, Share, Text, View, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../services/themeContext';
import { getCredentials } from '../../services/storage';
import { Account, Relationship } from '../../services/mastodon/types';
import { renderTextWithEmojis } from '../../services/emojiHelper';
import { StatusHtmlContent, openLink } from '../../components/TootCard/htmlContent';
import { Avatar, IconButton, PillButton, PugMark, SegmentOption, SegmentedPill } from '../../components/ui';
import { FollowButton } from '../../components/FollowButton/followButton';
import { useOpenAccount } from '../../hooks/useOpenAccount';
import { hitSlopFor, space } from '../../services/theme/shape';
import { useThemedStyles } from '../../services/theme/useThemedStyles';
import { useI18n } from '../../services/i18n/i18nContext';
import { AVATAR_SIZE, BANNER_HEIGHT, SHARE_SIZE, makeStyles } from './styles';

const originOf = (url?: string) => url?.match(/^https?:\/\/[^/?#]+/i)?.[0];

// "@user@instance": your own account's acct has no domain, so take it from the profile URL
export const fullHandle = (account: Account) => {
    if (account.acct.includes('@')) return `@${account.acct}`;
    const domain = originOf(account.url)?.replace(/^https?:\/\//i, '');
    return domain ? `@${account.acct}@${domain}` : `@${account.acct}`;
};

// Mastodon serves a placeholder image (".../missing.png") when there's no header
const hasHeaderImage = (account: Account) => !!account.header && !account.header.includes('missing');

interface ProfileHeaderProps<T extends string> {
    user: Account;
    // Your own profile (edit, settings) or someone else's (back, follow)
    mode: 'self' | 'other';
    tabs: SegmentOption<T>[];
    tab: T;
    onChangeTab: (tab: T) => void;
    onSettingsPress?: () => void;
    onBack?: () => void;
    relationship?: Relationship;
    // Space for the status bar when the profile is drawn full screen
    topInset?: number;
}

export function ProfileHeader<T extends string>({ user, mode, tabs, tab, onChangeTab, onSettingsPress, onBack, relationship, topInset = 0 }: ProfileHeaderProps<T>) {
    const { colors, type, coat } = useTheme();
    const { t, locale } = useI18n();
    const styles = useThemedStyles(makeStyles);
    const { width } = useWindowDimensions();
    const { openMention, openHashtag } = useOpenAccount();
    const name = user.display_name || user.username;
    const remoteServer = mode === 'other' && user.acct.includes('@') ? user.acct.split('@').pop() : undefined;

    const handleEditProfile = async () => {
        const { instanceUrl } = await getCredentials();
        const base = instanceUrl ?? originOf(user.url);
        if (base) {
            openLink(`${base.replace(/\/$/, '')}/settings/profile`);
        }
    };

    const handleShare = async () => {
        if (!user.url) return;
        try {
            await Share.share({ message: t('profile.shareMessage', { url: user.url }) });
        } catch (error: any) {
            Alert.alert(t('profile.shareFailed'), error.message);
        }
    };

    const stat = (count: number | undefined, label: string) => (
        <Text style={[type.body, styles.stat]}>
            <Text style={[type.name, styles.statNumber]}>{(count ?? 0).toLocaleString(locale)}</Text> {label}
        </Text>
    );

    return (
        <View style={styles.header}>
            <View style={[styles.banner, topInset > 0 && { height: BANNER_HEIGHT + topInset }]}>
                {hasHeaderImage(user) ? (
                    <Image testID="profile-banner-image" source={{ uri: user.header }} style={styles.bannerImage} />
                ) : (
                    <View testID="profile-banner-mark" style={styles.bannerMark}>
                        <PugMark coat={coat} size={220} />
                    </View>
                )}
                {onBack && (
                    <IconButton
                        icon="arrow-back"
                        accessibilityLabel={t('account.back')}
                        onPress={onBack}
                        style={[styles.bannerButton, styles.bannerButtonLeft, { top: topInset + space.md }]}
                    />
                )}
                {mode === 'self' && onSettingsPress && (
                    <IconButton
                        icon="options-outline"
                        accessibilityLabel={t('common.settings')}
                        onPress={onSettingsPress}
                        style={[styles.bannerButton, { top: topInset + space.md }]}
                    />
                )}
            </View>

            <View style={styles.info}>
                <View style={styles.avatarRow}>
                    <View style={styles.avatarRing}>
                        <Avatar name={name} uri={user.avatar} size={AVATAR_SIZE} />
                    </View>
                    <View style={styles.actions}>
                        {mode === 'self' ? (
                            <PillButton label={t('profile.editProfile')} variant="secondary" onPress={handleEditProfile} />
                        ) : (
                            <FollowButton accountId={user.id} name={name} relationship={relationship} allowUnfollow size="medium" />
                        )}
                        <Pressable
                            onPress={handleShare}
                            accessibilityRole="button"
                            accessibilityLabel={t('profile.shareProfile')}
                            hitSlop={hitSlopFor(SHARE_SIZE, SHARE_SIZE)}
                            style={({ pressed }) => [styles.share, pressed && { opacity: 0.7 }]}
                        >
                            <Ionicons name="share-outline" size={18} color={colors.textPrimary} />
                        </Pressable>
                    </View>
                </View>

                <View style={styles.names}>
                    <Text accessibilityRole="header" style={[type.title, styles.name]} numberOfLines={2}>
                        {renderTextWithEmojis(name, user.emojis || [], [type.title, styles.name], 24)}
                    </Text>
                    <Text style={[type.meta, styles.handle]} numberOfLines={1}>{fullHandle(user)}</Text>
                </View>

                {mode === 'other' && (relationship?.followed_by || remoteServer) && (
                    <View style={styles.otherInfo}>
                        {relationship?.followed_by && (
                            <View style={styles.followsYou}>
                                <Text style={[type.label, styles.followsYouText]}>{t('account.followsYou')}</Text>
                            </View>
                        )}
                        {remoteServer && !!user.url && (
                            <Pressable
                                onPress={() => openLink(user.url!)}
                                accessibilityRole="link"
                                accessibilityLabel={t('account.openOnServer', { server: remoteServer })}
                                hitSlop={hitSlopFor(0, 20)}
                                style={({ pressed }) => [styles.remoteLink, pressed && { opacity: 0.7 }]}
                            >
                                <Ionicons name="open-outline" size={14} color={colors.accentText} />
                                <Text style={[type.meta, styles.remoteLinkText]}>{t('account.openOnServer', { server: remoteServer })}</Text>
                            </Pressable>
                        )}
                    </View>
                )}

                {!!user.note && (
                    <StatusHtmlContent
                        content={user.note}
                        emojis={user.emojis}
                        colors={colors}
                        bodyFont={type.body}
                        compactMode={false}
                        width={width - 40}
                        onPressMention={openMention}
                        onPressHashtag={openHashtag}
                        onPressLink={openLink}
                    />
                )}

                <View style={styles.stats}>
                    {stat(user.statuses_count, t('profile.statPosts'))}
                    {stat(user.following_count, t('profile.statFollowing'))}
                    {stat(user.followers_count, t('profile.statFollowers'))}
                </View>
            </View>

            <View style={styles.tabs}>
                <SegmentedPill variant="underline" options={tabs} value={tab} onChange={onChangeTab} />
            </View>
        </View>
    );
}
