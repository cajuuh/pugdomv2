import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, DeviceEventEmitter, RefreshControl, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../services/authContext';
import { useTheme } from '../../services/themeContext';
import { Status } from '../../services/mastodon/types';
import { accountStatusesKey, ProfileTab, useAccountStatuses } from '../../hooks/useAccountStatuses';
import { useBookmarks } from '../../hooks/useBookmarks';
import { TootCard } from '../../components/TootCard/tootCard';
import { SegmentOption } from '../../components/ui';
import { useThemedStyles } from '../../services/theme/useThemedStyles';
import { makeStyles } from './styles';
import { fullHandle, ProfileHeader } from './profileHeader';
import { useI18n } from '../../services/i18n/i18nContext';

interface ProfileProps {
    onStatusPress?: (id: string) => void;
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

export { fullHandle };

// No settings button on the banner: the top bar above the tab already has one
const Profile = ({ onStatusPress }: ProfileProps) => {
    const { user, checkLoginStatus } = useAuth();
    const { colors, type } = useTheme();
    const { t } = useI18n();
    const styles = useThemedStyles(makeStyles);
    const queryClient = useQueryClient();
    const [tab, setTab] = useState<Tab>('posts');
    const tabs: SegmentOption<Tab>[] = TABS.map(value => ({ value, label: t(`profile.${value}`) }));
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
                ListHeaderComponent={<ProfileHeader user={user} mode="self" tabs={tabs} tab={tab} onChangeTab={setTab} />}
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
