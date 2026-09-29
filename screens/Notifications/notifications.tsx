import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, TouchableOpacity } from 'react-native';
import { FlashList, useRecyclingState } from '@shopify/flash-list';
import { View, Text, Avatar } from 'react-native-ui-lib';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Notification, Relationship } from '../../services/mastodon/types';
import { useTheme } from '../../services/themeContext';
import { renderTextWithEmojis } from '../../services/emojiHelper';
import { NotificationFilter, SUPPORTED_NOTIFICATION_TYPES, useNotifications } from '../../hooks/useNotifications';
import { useFollowAccount, useRelationships } from '../../hooks/useRelationships';
import { PillButton, SegmentedPill, SegmentOption } from '../../components/ui';
import { makeStyles } from './styles';
import { useThemedStyles } from '../../services/theme/useThemedStyles';

interface NotificationsProps {
    onStatusPress?: (id: string) => void;
}

const FILTERS: SegmentOption<NotificationFilter>[] = [
    { value: 'all', label: 'All' },
    { value: 'mentions', label: 'Mentions' },
    { value: 'follows', label: 'Follows' },
];

// Icon and copy for each notification type the screen renders; types share the accent and differ by icon and label
const TYPE_CONFIG: Record<string, { icon: React.ComponentProps<typeof Ionicons>['name']; tag: string; action: string }> = {
    favourite: { icon: 'star', tag: 'FAVOURITE', action: 'favourited your status' },
    reblog: { icon: 'repeat', tag: 'BOOST', action: 'boosted your status' },
    mention: { icon: 'chatbubble', tag: 'MENTION', action: 'mentioned you' },
    follow: { icon: 'person-add', tag: 'NEW FOLLOWER', action: 'followed you' },
};

const stripHtml = (html?: string) => {
    if (!html) return '';
    return html.replace(/<[^>]*>?/gm, '').replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
};

interface FollowBackProps {
    accountId: string;
    relationship?: Relationship;
}

const FollowBack = ({ accountId, relationship }: FollowBackProps) => {
    const styles = useThemedStyles(makeStyles);
    const followAccount = useFollowAccount();
    // FlashList recycles rows, so reset when the row shows another account
    const [pending, setPending] = useRecyclingState(false, [accountId]);

    // Hide until the relationship is known, so we never offer to follow someone we already follow
    if (!relationship) {
        return null;
    }
    if (relationship.following || relationship.requested) {
        return (
            <Text style={styles.followState}>
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
        <PillButton
            label={pending ? 'Following…' : 'Follow back'}
            size="small"
            style={styles.followButton}
            disabled={pending}
            onPress={handleFollow}
        />
    );
};

const Notifications = ({ onStatusPress }: NotificationsProps) => {
    const { colors } = useTheme();
    const styles = useThemedStyles(makeStyles);
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
        const showPreview = item.type !== 'follow';

        return (
            <TouchableOpacity
                style={styles.notificationCard}
                onPress={() => item.status && onStatusPress?.(item.status.id)}
                activeOpacity={item.status ? 0.8 : 1}
            >
                <View style={styles.headerArchitecture}>
                    <Avatar source={{ uri: item.account.avatar }} size={42} containerStyle={styles.avatar} />
                    <Text style={styles.actionText}>
                        {renderTextWithEmojis(
                            item.account.display_name || item.account.username,
                            item.account.emojis || [],
                            styles.displayName,
                            16
                        )}
                        <Text style={styles.actionVerb}>{' '}{config.action}</Text>
                    </Text>
                    {/* In the row, not absolutely positioned, so long names wrap instead of running under it */}
                    <View style={styles.asymmetricTagLayer}>
                        <Ionicons name={config.icon} size={14} color={colors.accentText} />
                        <Text style={styles.tagText}>{config.tag}</Text>
                    </View>
                </View>

                {showPreview && item.status && (
                    <Text
                        style={[
                            styles.statusPreview,
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
                <Text style={styles.emptyText}>No notifications yet!</Text>
            </View>
        );
    };

    return (
        <View flex style={[styles.container, { backgroundColor: colors.background }]}>
            <View paddingH-16 paddingV-10 style={{ zIndex: 10 }}>
                <SegmentedPill options={FILTERS} value={activeFilter} onChange={setActiveFilter} />
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
