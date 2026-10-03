import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, DeviceEventEmitter, Image, Pressable, RefreshControl, Share, Text, View, useWindowDimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../../services/authContext';
import { useTheme } from '../../services/themeContext';
import { getCredentials } from '../../services/storage';
import { Account, Status } from '../../services/mastodon/types';
import { renderTextWithEmojis } from '../../services/emojiHelper';
import { accountStatusesKey, ProfileTab, useAccountStatuses } from '../../hooks/useAccountStatuses';
import { useBookmarks } from '../../hooks/useBookmarks';
import { TootCard } from '../../components/TootCard/tootCard';
import { StatusHtmlContent, openLink } from '../../components/TootCard/htmlContent';
import { Avatar, IconButton, PillButton, PugMark, SegmentOption, SegmentedPill } from '../../components/ui';
import { hitSlopFor } from '../../services/theme/shape';
import { useThemedStyles } from '../../services/theme/useThemedStyles';
import { AVATAR_SIZE, SHARE_SIZE, makeStyles } from './styles';
import { useI18n } from '../../services/i18n/i18nContext';

interface ProfileProps {
    onStatusPress?: (id: string) => void;
    onSettingsPress?: () => void;
}

// Bookmarks are private to you, and this is always your own profile
type Tab = ProfileTab | 'bookmarks';

const TABS: Tab[] = ['posts', 'replies', 'media', 'bookmarks'];

const EMPTY_TEXT = {
    posts: 'profile.emptyPosts',
    replies: 'profile.emptyReplies',
    media: 'profile.emptyMedia',
    bookmarks: 'profile.emptyBookmarks',
} as const;

const originOf = (url?: string) => url?.match(/^https?:\/\/[^/?#]+/i)?.[0];

// "@user@instance": your own account's acct has no domain, so take it from the profile URL
export const fullHandle = (account: Account) => {
    if (account.acct.includes('@')) return `@${account.acct}`;
    const domain = originOf(account.url)?.replace(/^https?:\/\//i, '');
    return domain ? `@${account.acct}@${domain}` : `@${account.acct}`;
};

// Mastodon serves a placeholder image (".../missing.png") when there's no header
const hasHeaderImage = (account: Account) => !!account.header && !account.header.includes('missing');

interface ProfileHeaderProps {
    user: Account;
    tab: Tab;
    onChangeTab: (tab: Tab) => void;
    onSettingsPress?: () => void;
}

const ProfileHeader = ({ user, tab, onChangeTab, onSettingsPress }: ProfileHeaderProps) => {
    const { colors, type, coat } = useTheme();
    const { t, locale } = useI18n();
    const tabs: SegmentOption<Tab>[] = TABS.map(value => ({ value, label: t(`profile.${value}`) }));
    const styles = useThemedStyles(makeStyles);
    const { width } = useWindowDimensions();
    const name = user.display_name || user.username;

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
            <View style={styles.banner}>
                {hasHeaderImage(user) ? (
                    <Image testID="profile-banner-image" source={{ uri: user.header }} style={styles.bannerImage} />
                ) : (
                    <View testID="profile-banner-mark" style={styles.bannerMark}>
                        <PugMark coat={coat} size={220} />
                    </View>
                )}
                {onSettingsPress && (
                    <IconButton icon="options-outline" accessibilityLabel={t('common.settings')} onPress={onSettingsPress} style={styles.bannerButton} />
                )}
            </View>

            <View style={styles.info}>
                <View style={styles.avatarRow}>
                    <View style={styles.avatarRing}>
                        <Avatar name={name} uri={user.avatar} size={AVATAR_SIZE} />
                    </View>
                    <View style={styles.actions}>
                        <PillButton label={t('profile.editProfile')} variant="secondary" onPress={handleEditProfile} />
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

                {!!user.note && (
                    <StatusHtmlContent
                        content={user.note}
                        emojis={user.emojis}
                        colors={colors}
                        bodyFont={type.body}
                        compactMode={false}
                        width={width - 40}
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
};

const Profile = ({ onStatusPress, onSettingsPress }: ProfileProps) => {
    const { user, checkLoginStatus } = useAuth();
    const { colors, type } = useTheme();
    const { t } = useI18n();
    const styles = useThemedStyles(makeStyles);
    const queryClient = useQueryClient();
    const [tab, setTab] = useState<Tab>('posts');
    const [isPullRefreshing, setIsPullRefreshing] = useState(false);

    const showBookmarks = tab === 'bookmarks';
    const accountStatuses = useAccountStatuses(user?.id, showBookmarks ? 'posts' : tab, !showBookmarks);
    const bookmarks = useBookmarks(showBookmarks);
    const { isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, refetch } = showBookmarks ? bookmarks : accountStatuses;
    const statuses = showBookmarks
        ? bookmarks.data?.pages.flatMap(page => page.statuses) ?? []
        : accountStatuses.data?.pages.flat() ?? [];

    // A new post belongs at the top of your own lists
    useEffect(() => {
        if (!user) return;
        const subscription = DeviceEventEmitter.addListener('status_published', () => {
            queryClient.invalidateQueries({ queryKey: accountStatusesKey(user.id) });
        });
        return () => subscription.remove();
    }, [queryClient, user]);

    // Refreshes the counts in the header too
    const handleRefresh = useCallback(async () => {
        setIsPullRefreshing(true);
        try {
            await Promise.all([checkLoginStatus(), refetch()]);
        } finally {
            setIsPullRefreshing(false);
        }
    }, [checkLoginStatus, refetch]);

    if (!user) {
        return null;
    }

    const handleLoadMore = () => {
        if (!isFetchingNextPage && hasNextPage) {
            fetchNextPage();
        }
    };

    const renderEmpty = () => (
        <View style={styles.empty}>
            {isLoading
                ? <ActivityIndicator color={colors.accentColor} />
                : <Text style={[type.body, styles.emptyText]}>{t(EMPTY_TEXT[tab])}</Text>}
        </View>
    );

    return (
        <View style={styles.container}>
            <FlashList
                data={statuses}
                keyExtractor={(item: Status) => item.id}
                renderItem={({ item }) => <TootCard status={item} onPress={onStatusPress} />}
                ListHeaderComponent={<ProfileHeader user={user} tab={tab} onChangeTab={setTab} onSettingsPress={onSettingsPress} />}
                ListEmptyComponent={renderEmpty}
                ListFooterComponent={isFetchingNextPage ? <ActivityIndicator style={styles.footer} color={colors.accentColor} /> : null}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                refreshControl={
                    <RefreshControl
                        refreshing={isPullRefreshing}
                        onRefresh={handleRefresh}
                        tintColor={colors.accentColor}
                        colors={[colors.accentColor]}
                    />
                }
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
};

export default Profile;
