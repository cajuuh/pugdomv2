import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, TouchableOpacity } from 'react-native';
import { FlashList, useRecyclingState } from '@shopify/flash-list';
import { View, Text, Avatar, Button, SegmentedControl } from 'react-native-ui-lib';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Notification, Relationship } from '../../services/mastodon/types';
import { useTheme } from '../../services/themeContext';
import { renderTextWithEmojis } from '../../services/emojiHelper';
import { NotificationFilter, SUPPORTED_NOTIFICATION_TYPES, useNotifications } from '../../hooks/useNotifications';
import { useFollowAccount, useRelationships } from '../../hooks/useRelationships';
import { styles } from './styles';

interface NotificationsProps {
    onStatusPress?: (id: string) => void;
}

const FILTERS: NotificationFilter[] = ['all', 'mentions', 'follows'];

// Icon, tint and copy for each notification type the screen renders
const TYPE_CONFIG: Record<string, { icon: string; color: string; rgb: string; tag: string; action: string }> = {
    favourite: { icon: 'star', color: '#0EA5E9', rgb: '14, 165, 233', tag: 'FAVOURITE', action: 'favourited your status' },
    reblog: { icon: 'repeat', color: '#F59E0B', rgb: '245, 158, 11', tag: 'BOOST', action: 'boosted your status' },
    mention: { icon: 'chatbubble', color: '#EC4899', rgb: '236, 72, 153', tag: 'MENTION', action: 'mentioned you' },
    follow: { icon: 'person-add', color: '#22C55E', rgb: '34, 197, 94', tag: 'NEW FOLLOWER', action: 'followed you' },
};

const stripHtml = (html?: string) => {
    if (!html) return '';
    return html.replace(/<[^>]*>?/gm, '').replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
};

interface FollowBackProps {
    accountId: string;
    relationship?: Relationship;
    color: string;
    textColor: string;
}

const FollowBack = ({ accountId, relationship, color, textColor }: FollowBackProps) => {
    const followAccount = useFollowAccount();
    // FlashList recycles rows, so reset when the row shows another account
    const [pending, setPending] = useRecyclingState(false, [accountId]);

    // Hide until the relationship is known, so we never offer to follow someone we already follow
    if (!relationship) {
        return null;
    }
    if (relationship.following || relationship.requested) {
        return (
            <Text style={[styles.followState, { color: textColor }]}>
                {relationship.following ? 'Following' : 'Follow requested'}
            </Text>
        );
    }

    const handleFollow = async () => {
        setPending(true);
        try {
            await followAccount(accountId);
        } catch (error) {
            Alert.alert('Error', 'Failed to follow this account. Please try again.');
        } finally {
            setPending(false);
        }
    };

    return (
        <Button
            label={pending ? 'Following…' : 'Follow back'}
            size={Button.sizes.small}
            backgroundColor={color}
            style={styles.followButton}
            disabled={pending}
            onPress={handleFollow}
        />
    );
};

const Notifications = ({ onStatusPress }: NotificationsProps) => {
    const { colors, isDark } = useTheme();
    const [activeFilter, setActiveFilter] = useState<NotificationFilter>('all');
    const [isPullRefreshing, setIsPullRefreshing] = useState(false);

    const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, refetch } = useNotifications(activeFilter);

    // The server already filters by type; this guards against types the screen can't render
    const notifications = useMemo(
        () => (data?.pages.flat() ?? []).filter(n => SUPPORTED_NOTIFICATION_TYPES.includes(n.type)),
        [data]
    );

    const followerIds = useMemo(
        () => notifications.filter(n => n.type === 'follow').map(n => n.account.id),
        [notifications]
    );
    const relationships = useRelationships(followerIds);

    // Track pull-to-refresh separately so background refetches (e.g. returning to the tab) don't show the spinner
    const handleRefresh = useCallback(async () => {
        setIsPullRefreshing(true);
        try {
            await refetch();
        } finally {
            setIsPullRefreshing(false);
        }
    }, [refetch]);

    const handleLoadMore = () => {
        if (!isFetchingNextPage && hasNextPage) {
            fetchNextPage();
        }
    };

    const renderNotification = ({ item }: { item: Notification }) => {
        const config = TYPE_CONFIG[item.type];
        const cardBackgroundColor = `rgba(${config.rgb}, ${isDark ? 0.15 : 0.08})`;
        const borderColor = `rgba(${config.rgb}, ${isDark ? 0.3 : 0.2})`;
        const showPreview = item.type !== 'follow';

        return (
            <TouchableOpacity
                style={[styles.notificationCard, { backgroundColor: cardBackgroundColor, borderColor }]}
                onPress={() => item.status && onStatusPress?.(item.status.id)}
                activeOpacity={item.status ? 0.8 : 1}
            >
                <View style={styles.headerArchitecture}>
                    <Avatar source={{ uri: item.account.avatar }} size={42} containerStyle={styles.avatar} />
                    <Text style={[styles.actionText, { color: colors.textPrimary }]}>
                        {renderTextWithEmojis(
                            item.account.display_name || item.account.username,
                            item.account.emojis || [],
                            styles.displayName,
                            16
                        )}
                        <Text>{' '}{config.action}</Text>
                    </Text>
                    {/* In the row, not absolutely positioned, so long names wrap instead of running under it */}
                    <View style={[styles.asymmetricTagLayer, { backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.7)', borderColor }]}>
                        <Ionicons name={config.icon as any} size={14} color={config.color} />
                        <Text style={[styles.tagText, { color: config.color }]}>{config.tag}</Text>
                    </View>
                </View>

                {showPreview && item.status && (
                    <Text
                        style={[
                            styles.statusPreview,
                            { color: colors.textPrimary },
                            item.type === 'mention' && { fontWeight: '600', fontSize: 16 }
                        ]}
                        numberOfLines={3}
                    >
                        {stripHtml(item.status.content)}
                    </Text>
                )}
                {item.type === 'follow' && (
                    <FollowBack
                        accountId={item.account.id}
                        relationship={relationships.get(item.account.id)}
                        color={config.color}
                        textColor={colors.textSecondary}
                    />
                )}
            </TouchableOpacity>
        );
    };

    const renderFooter = () => {
        if (!isFetchingNextPage) return null;
        return (
            <View paddingV-20 center>
                <ActivityIndicator size={'small'} color={colors.accentColor} />
            </View>
        );
    };

    const renderEmpty = () => {
        if (isLoading) return null;
        return (
            <View flex center padding-40 style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No notifications yet!</Text>
            </View>
        );
    };

    return (
        <View flex style={[styles.container, { backgroundColor: colors.background }]}>
            <View paddingH-16 paddingV-10 style={{ zIndex: 10 }}>
                <SegmentedControl
                    segments={[{ label: 'All' }, { label: 'Mentions' }, { label: 'Follows' }]}
                    initialIndex={FILTERS.indexOf(activeFilter)}
                    activeColor={colors.accentColor}
                    onChangeIndex={(index: number) => setActiveFilter(FILTERS[index])}
                />
            </View>
            {isLoading && notifications.length === 0 ? (
                <View flex center style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                    <ActivityIndicator size={'large'} color={colors.accentColor} />
                </View>
            ) : (
                <FlashList
                    data={notifications}
                    keyExtractor={(item) => item.id}
                    renderItem={renderNotification}
                    // Rows read follow state from outside `data`, so re-render them when it changes
                    extraData={relationships}
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
                    ListFooterComponent={renderFooter}
                    ListEmptyComponent={renderEmpty}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </View>
    );
};

export default Notifications;
