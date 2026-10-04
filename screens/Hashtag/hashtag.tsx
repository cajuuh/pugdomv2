import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../services/themeContext';
import { useThemedStyles } from '../../services/theme/useThemedStyles';
import { useI18n } from '../../services/i18n/i18nContext';
import { useTag, useTagTimeline, useToggleFollowTag } from '../../hooks/useTag';
import { weeklyUsage } from '../../services/mastodon/tags';
import { Status } from '../../services/mastodon/types';
import { TootCard } from '../../components/TootCard/tootCard';
import { IconButton, PillButton } from '../../components/ui';
import { makeStyles } from './styles';

interface HashtagProps {
    tag: string;
    onBack: () => void;
    onStatusPress: (id: string) => void;
}

// A hashtag's posts, how active it was this week, and following it
const Hashtag = ({ tag, onBack, onStatusPress }: HashtagProps) => {
    const { colors, type } = useTheme();
    const { t, tn } = useI18n();
    const styles = useThemedStyles(makeStyles);
    const insets = useSafeAreaInsets();
    const [isPullRefreshing, setIsPullRefreshing] = useState(false);
    const [followPending, setFollowPending] = useState(false);

    const { data: info, refetch: refetchInfo } = useTag(tag);
    const toggleFollow = useToggleFollowTag(tag);
    const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, refetch } = useTagTimeline(tag);
    const statuses = data?.pages.flat() ?? [];
    // The server's spelling of the tag once known (e.g. #PugsOfMastodon)
    const name = info?.name ?? tag;
    const usage = weeklyUsage(info);

    const setFollowing = async (follow: boolean) => {
        setFollowPending(true);
        try {
            await toggleFollow(follow);
        } catch {
            Alert.alert(t('common.error'), t('hashtag.followFailed'));
        } finally {
            setFollowPending(false);
        }
    };

    const confirmUnfollow = () =>
        Alert.alert(t('hashtag.unfollowTitle', { tag: name }), undefined, [
            { text: t('hashtag.keep'), style: 'cancel' },
            { text: t('hashtag.unfollow'), style: 'destructive', onPress: () => setFollowing(false) },
        ]);

    const handleRefresh = useCallback(async () => {
        setIsPullRefreshing(true);
        try {
            await Promise.all([refetchInfo(), refetch()]);
        } finally {
            setIsPullRefreshing(false);
        }
    }, [refetchInfo, refetch]);

    const intro = (
        <View style={styles.intro}>
            <Text accessibilityRole="header" style={[type.title, styles.tag]}>#{name}</Text>
            {info && (
                <Text style={[type.body, styles.usage]}>
                    {usage.posts > 0
                        ? t('hashtag.usage', { posts: tn('hashtag.posts', usage.posts), people: tn('hashtag.people', usage.people) })
                        : t('hashtag.quiet')}
                </Text>
            )}
            {info && (
                info.following ? (
                    <PillButton label={t('hashtag.following')} icon="checkmark" variant="secondary" disabled={followPending} onPress={confirmUnfollow} />
                ) : (
                    <PillButton label={t('hashtag.follow')} disabled={followPending} onPress={() => setFollowing(true)} />
                )
            )}
            {info && !info.following && <Text style={[type.meta, styles.followHint]}>{t('hashtag.followHint')}</Text>}
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <IconButton icon="arrow-back" accessibilityLabel={t('common.goBack')} onPress={onBack} />
                <Text style={[type.name, styles.headerTitle]} numberOfLines={1}>#{name}</Text>
                <View style={styles.headerSpacer} />
            </View>
            <FlashList
                data={statuses}
                keyExtractor={(item: Status) => item.id}
                renderItem={({ item }) => <TootCard status={item} onPress={onStatusPress} />}
                ListHeaderComponent={intro}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        {isLoading
                            ? <ActivityIndicator color={colors.accentColor} />
                            : <Text style={[type.body, styles.emptyText]}>{t('hashtag.empty', { tag: name })}</Text>}
                    </View>
                }
                ListFooterComponent={isFetchingNextPage ? <ActivityIndicator style={styles.footer} color={colors.accentColor} /> : null}
                onEndReached={() => {
                    if (!isFetchingNextPage && hasNextPage) fetchNextPage();
                }}
                onEndReachedThreshold={0.5}
                refreshControl={
                    <RefreshControl refreshing={isPullRefreshing} onRefresh={handleRefresh} tintColor={colors.accentColor} colors={[colors.accentColor]} />
                }
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
};

export default Hashtag;
