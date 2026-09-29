import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, Text, View } from 'react-native';
import { FlashList, useRecyclingState } from '@shopify/flash-list';
import { InfiniteData, useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Notification, Relationship, Status } from '../../services/mastodon/types';
import { favouriteStatus, unfavouriteStatus } from '../../services/mastodon/statuses';
import { markNotificationsRead } from '../../services/mastodon/markers';
import { useTheme } from '../../services/themeContext';
import { useCompose } from '../../services/composeContext';
import { renderTextWithEmojis } from '../../services/emojiHelper';
import { NotificationFilter, SUPPORTED_NOTIFICATION_TYPES, useNotifications } from '../../hooks/useNotifications';
import { useFollowAccount, useRelationships } from '../../hooks/useRelationships';
import { useUpdateCachedStatus } from '../../hooks/useUpdateCachedStatus';
import { Avatar, IconButton, PillButton, SectionLabel, SegmentOption, SegmentedPill, Well } from '../../components/ui';
import { hitSlopFor } from '../../services/theme/shape';
import { FAVOURITE_SIZE, makeStyles } from './styles';
import { useThemedStyles } from '../../services/theme/useThemedStyles';
import { ListItem, buildListItems, notificationTime, plainText, withoutLeadingMentions } from './rows';

interface NotificationsProps {
    onStatusPress?: (id: string) => void;
}

const FILTERS: SegmentOption<NotificationFilter>[] = [
    { value: 'all', label: 'All' },
    { value: 'mentions', label: 'Mentions' },
    { value: 'follows', label: 'Follows' },
];

// Types share the accent and differ by glyph and wording
const TYPE_CONFIG: Record<string, { badge: React.ComponentProps<typeof Ionicons>['name']; action: string }> = {
    mention: { badge: 'at', action: 'mentioned you' },
    favourite: { badge: 'star', action: 'favourited your post' },
    reblog: { badge: 'repeat', action: 'boosted your post' },
    follow: { badge: 'person-add', action: 'followed you' },
};

// Notification ids are snowflakes: a longer id is newer, and equal lengths compare as strings
const isNewer = (a: string, b: string) => (a.length !== b.length ? a.length > b.length : a > b);

const displayNameOf = (notification: Notification) => notification.account.display_name || notification.account.username;

// What the row shows of the post: the content warning when there is one, never the text behind it
const statusText = (status: Status, type: Notification['type']) => {
    if (status.spoiler_text) return `CW: ${status.spoiler_text}`;
    const text = plainText(status.content);
    return type === 'mention' ? withoutLeadingMentions(text) : text;
};

interface FollowBackProps {
    accountId: string;
    relationship?: Relationship;
}

const FollowBack = ({ accountId, relationship }: FollowBackProps) => {
    const { colors, type } = useTheme();
    const styles = useThemedStyles(makeStyles);
    const followAccount = useFollowAccount();
    // FlashList recycles rows, so reset when the row shows another account
    const [pending, setPending] = useRecyclingState(false, [accountId]);

    // Hide until the relationship is known, so we never offer to follow someone we already follow
    if (!relationship) {
        return null;
    }
    if (relationship.following || relationship.requested) {
        // Locked accounts approve follows first, so a follow sent to them stays "Requested"
        const label = relationship.following ? 'Following' : 'Requested';
        return (
            <View style={styles.followState} accessible accessibilityLabel={label}>
                <Ionicons name={relationship.following ? 'checkmark' : 'time-outline'} size={15} color={colors.accentText} />
                <Text style={[type.name, styles.followStateText]}>{label}</Text>
            </View>
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
            disabled={pending}
            onPress={handleFollow}
        />
    );
};

const MentionActions = ({ status }: { status: Status }) => {
    const { colors } = useTheme();
    const styles = useThemedStyles(makeStyles);
    const { openCompose } = useCompose();
    const updateCachedStatus = useUpdateCachedStatus();
    const [isFavourited, setIsFavourited] = useRecyclingState(!!status.favourited, [status.id]);

    // Lets the request skip rolling back if the row was recycled while it was in flight
    const renderedStatusId = useRef(status.id);
    renderedStatusId.current = status.id;

    const toggleFavourite = async () => {
        const previous = isFavourited;
        setIsFavourited(!previous);
        try {
            updateCachedStatus(previous ? await unfavouriteStatus(status.id) : await favouriteStatus(status.id));
        } catch (error) {
            if (renderedStatusId.current !== status.id) return;
            setIsFavourited(previous);
            Alert.alert('Error', 'Failed to update favorite status. Please try again.');
        }
    };

    return (
        <View style={styles.actions}>
            <PillButton
                label="Reply"
                icon="arrow-undo-outline"
                variant="secondary"
                size="small"
                onPress={() => openCompose({ replyToStatus: status })}
            />
            <Pressable
                onPress={toggleFavourite}
                accessibilityRole="button"
                accessibilityLabel="Favourite"
                accessibilityState={{ selected: isFavourited }}
                hitSlop={hitSlopFor(FAVOURITE_SIZE, FAVOURITE_SIZE)}
                style={({ pressed }) => [styles.favourite, isFavourited && styles.favouriteOn, pressed && { opacity: 0.7 }]}
            >
                <Ionicons
                    name={isFavourited ? 'star' : 'star-outline'}
                    size={16}
                    color={isFavourited ? colors.accentText : colors.textSecondary}
                />
            </Pressable>
        </View>
    );
};

interface NotificationRowProps {
    notification: Notification;
    relationship?: Relationship;
    onStatusPress?: (id: string) => void;
}

const NotificationRow = ({ notification, relationship, onStatusPress }: NotificationRowProps) => {
    const { type } = useTheme();
    const styles = useThemedStyles(makeStyles);
    const config = TYPE_CONFIG[notification.type];
    const { account, status } = notification;
    const name = displayNameOf(notification);
    const time = notificationTime(notification.created_at);
    const openStatus = status && onStatusPress ? () => onStatusPress(status.id) : undefined;

    const headline = (
        <Text style={styles.headlineText} numberOfLines={2}>
            {renderTextWithEmojis(name, account.emojis || [], [type.name, styles.displayName], 16)}
            <Text style={[type.body, styles.action]}>{' '}{config.action}</Text>
        </Text>
    );

    if (notification.type === 'follow') {
        return (
            <View style={[styles.row, styles.rowCentered]}>
                <Avatar name={name} uri={account.avatar} size={44} badge={config.badge} />
                <View style={[styles.content, styles.followContent]}>
                    {headline}
                    <Text style={[type.meta, styles.handle]} numberOfLines={1}>@{account.acct} · {time}</Text>
                </View>
                <FollowBack accountId={account.id} relationship={relationship} />
            </View>
        );
    }

    const text = status ? statusText(status, notification.type) : '';
    const body = (
        <>
            <View style={styles.headline}>
                {headline}
                <Text style={[type.meta, styles.time]}>{time}</Text>
            </View>
            {notification.type === 'mention' ? (
                !!text && renderTextWithEmojis(text, status?.emojis || [], [type.body, styles.mentionText])
            ) : (
                !!text && (
                    <Well style={styles.snippet}>
                        <Text style={[type.body, styles.snippetText]} numberOfLines={3}>
                            {renderTextWithEmojis(text, status?.emojis || [], [type.body, styles.snippetText], 14)}
                        </Text>
                    </Well>
                )
            )}
        </>
    );
    const label = `${name} ${config.action}, ${time}${text ? `: ${text}` : ''}`;

    if (notification.type === 'mention' && status) {
        // The row isn't one accessible element here, or screen readers couldn't reach Reply and Favourite;
        // the text block is its own button instead
        return (
            <Pressable onPress={openStatus} disabled={!openStatus} accessible={false} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                <Avatar name={name} uri={account.avatar} size={44} badge={config.badge} />
                <View style={styles.content}>
                    <Pressable onPress={openStatus} disabled={!openStatus} accessibilityRole="button" accessibilityLabel={label} style={styles.stack}>
                        {body}
                    </Pressable>
                    <MentionActions status={status} />
                </View>
            </Pressable>
        );
    }

    return (
        <Pressable
            onPress={openStatus}
            disabled={!openStatus}
            accessibilityRole={openStatus ? 'button' : undefined}
            accessibilityLabel={label}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
            <Avatar name={name} uri={account.avatar} size={44} badge={config.badge} />
            <View style={styles.content}>{body}</View>
        </Pressable>
    );
};

const Notifications = ({ onStatusPress }: NotificationsProps) => {
    const { colors, type } = useTheme();
    const styles = useThemedStyles(makeStyles);
    const queryClient = useQueryClient();
    const [activeFilter, setActiveFilter] = useState<NotificationFilter>('all');
    const [isPullRefreshing, setIsPullRefreshing] = useState(false);
    const [markedReadId, setMarkedReadId] = useState<string | null>(null);

    const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, refetch } = useNotifications(activeFilter);

    // The server already filters by type; this guards against types the screen can't render
    const notifications = useMemo(
        () => (data?.pages.flat() ?? []).filter(n => SUPPORTED_NOTIFICATION_TYPES.includes(n.type)),
        [data]
    );
    const listItems = useMemo(() => buildListItems(notifications), [notifications]);

    const followerIds = useMemo(
        () => notifications.filter(n => n.type === 'follow').map(n => n.account.id),
        [notifications]
    );
    const relationships = useRelationships(followerIds);

    // Newest notification across every loaded filter, so marking read from "Mentions" doesn't leave newer follows unread
    const newestId = useMemo(() => {
        const ids = queryClient
            .getQueriesData<InfiniteData<Notification[]>>({ queryKey: ['notifications'] })
            .map(([, cached]) => cached?.pages[0]?.[0]?.id)
            .filter((id): id is string => !!id);
        return ids.reduce<string | null>((newest, id) => (!newest || isNewer(id, newest) ? id : newest), null);
    }, [queryClient, data]);

    const handleMarkRead = async () => {
        if (!newestId) return;
        try {
            await markNotificationsRead(newestId);
            setMarkedReadId(newestId);
        } catch (error) {
            Alert.alert('Error', 'Failed to mark notifications as read. Please try again.');
        }
    };
    const allRead = !!newestId && markedReadId === newestId;

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

    const renderItem = ({ item, index }: { item: ListItem; index: number }) => {
        if (item.kind === 'section') {
            return <SectionLabel style={[styles.sectionLabel, index > 0 && styles.sectionLabelSpaced]}>{item.label}</SectionLabel>;
        }
        return (
            <View style={[styles.segment, item.first && styles.segmentFirst, item.last && styles.segmentLast]}>
                {!item.first && <View style={styles.separator} />}
                <NotificationRow
                    notification={item.notification}
                    relationship={relationships.get(item.notification.account.id)}
                    onStatusPress={onStatusPress}
                />
            </View>
        );
    };

    const renderFooter = () => {
        if (!isFetchingNextPage) return null;
        return (
            <View style={styles.footer}>
                <ActivityIndicator size={'small'} color={colors.accentColor} />
            </View>
        );
    };

    const renderEmpty = () => {
        if (isLoading) return null;
        return (
            <View style={styles.emptyContainer}>
                <Text style={[type.body, styles.emptyText]}>No notifications yet!</Text>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text accessibilityRole="header" style={[type.title, styles.title]}>Notifications</Text>
                <IconButton
                    icon="checkmark-done"
                    accessibilityLabel="Mark all as read"
                    onPress={handleMarkRead}
                    selected={allRead}
                    disabled={!newestId}
                    color={allRead ? colors.accentText : colors.textSecondary}
                    style={styles.markRead}
                />
            </View>
            <View style={styles.filters}>
                <SegmentedPill variant="chips" options={FILTERS} value={activeFilter} onChange={setActiveFilter} />
            </View>
            {isLoading && notifications.length === 0 ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size={'large'} color={colors.accentColor} />
                </View>
            ) : (
                <FlashList
                    data={listItems}
                    keyExtractor={(item) => item.key}
                    getItemType={(item) => (item.kind === 'section' ? 'section' : item.notification.type)}
                    renderItem={renderItem}
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
