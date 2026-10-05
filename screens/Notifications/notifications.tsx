import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, Text, View } from 'react-native';
import { FlashList, useRecyclingState } from '@shopify/flash-list';
import { InfiniteData, useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Account, Notification, NotificationGroup, Relationship, Status } from '../../services/mastodon/types';
import { NotificationGroupsPage, isNewerId, mergeGroups } from '../../services/mastodon/notifications';
import { favouriteStatus, unfavouriteStatus } from '../../services/mastodon/statuses';
import { markNotificationsRead } from '../../services/mastodon/markers';
import { useTheme } from '../../services/themeContext';
import { useCompose } from '../../services/composeContext';
import { renderTextWithEmojis } from '../../services/emojiHelper';
import { NotificationFilter, SUPPORTED_NOTIFICATION_TYPES, useNotifications } from '../../hooks/useNotifications';
import { useRelationships } from '../../hooks/useRelationships';
import { FollowButton } from '../../components/FollowButton/followButton';
import { useUpdateCachedStatus } from '../../hooks/useUpdateCachedStatus';
import { Avatar, AvatarBadge, IconButton, PillButton, SectionLabel, SegmentOption, SegmentedPill, Well } from '../../components/ui';
import { hitSlopFor } from '../../services/theme/shape';
import { FAVOURITE_SIZE, STACKED_AVATAR, makeStyles } from './styles';
import { useThemedStyles } from '../../services/theme/useThemedStyles';
import { ListItem, actorsText, buildListItems, notificationTime, plainText, withoutLeadingMentions } from './rows';
import { useI18n } from '../../services/i18n/i18nContext';
import { TKey, Translator } from '../../services/i18n/translate';
import { useOpenAccount } from '../../hooks/useOpenAccount';
import { useMarkNotificationsSeen } from '../../hooks/useUnreadNotifications';

interface NotificationsProps {
    onStatusPress?: (id: string) => void;
}

const FILTERS: NotificationFilter[] = ['all', 'mentions', 'follows'];

// Types share the accent and differ by glyph and wording
const TYPE_CONFIG: Record<string, { badge: React.ComponentProps<typeof Ionicons>['name']; action: TKey }> = {
    mention: { badge: 'at', action: 'notifications.mention' },
    favourite: { badge: 'star', action: 'notifications.favourite' },
    reblog: { badge: 'repeat', action: 'notifications.reblog' },
    follow: { badge: 'person-add', action: 'notifications.follow' },
    quote: { badge: 'chatbox-ellipses', action: 'notifications.quote' },
    // The post attached is your quote; the post it quotes was edited
    quoted_update: { badge: 'create', action: 'notifications.quotedUpdate' },
};

const nameOf = (account: Account) => account.display_name || account.username;

// What the row shows of the post: the content warning when there is one, never the text behind it
const statusText = (status: Status, type: Notification['type'], { t }: Translator) => {
    if (status.spoiler_text) return t('notifications.cw', { text: status.spoiler_text });
    const text = plainText(status.content);
    return type === 'mention' ? withoutLeadingMentions(text) : text;
};

const MentionActions = ({ status }: { status: Status }) => {
    const { colors } = useTheme();
    const styles = useThemedStyles(makeStyles);
    const { t } = useI18n();
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
            Alert.alert(t('common.error'), t('notifications.favouriteFailed'));
        }
    };

    return (
        <View style={styles.actions}>
            <PillButton
                label={t('notifications.reply')}
                icon="arrow-undo-outline"
                variant="secondary"
                size="small"
                onPress={() => openCompose({ replyToStatus: status })}
            />
            <Pressable
                onPress={toggleFavourite}
                accessibilityRole="button"
                accessibilityLabel={t('notifications.favouriteAction')}
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

// The two most recent people in a group, overlapping, with the type badge
const StackedAvatars = ({ accounts, badge }: { accounts: Account[]; badge: React.ComponentProps<typeof Ionicons>['name'] }) => {
    const styles = useThemedStyles(makeStyles);
    return (
        <View testID="avatar-stack" style={styles.stack44}>
            {accounts.slice(0, 2).map((account, index) => (
                <View key={account.id} style={[styles.stacked, index === 0 ? styles.stackedBack : styles.stackedFront]}>
                    <Avatar name={nameOf(account)} uri={account.avatar} size={STACKED_AVATAR} />
                </View>
            ))}
            <AvatarBadge icon={badge} />
        </View>
    );
};

interface NotificationRowProps {
    group: NotificationGroup;
    relationship?: Relationship;
    onStatusPress?: (id: string) => void;
}

const NotificationRow = ({ group, relationship, onStatusPress }: NotificationRowProps) => {
    const { type } = useTheme();
    const styles = useThemedStyles(makeStyles);
    const i18n = useI18n();
    const { t, tn } = i18n;
    const { openAccount } = useOpenAccount();
    const config = TYPE_CONFIG[group.type];
    const action = t(config.action);
    const { status } = group;
    const account = group.accounts[0];
    const name = account ? nameOf(account) : '';
    const time = notificationTime(group.created_at, new Date(), i18n);
    const openStatus = status && onStatusPress ? () => onStatusPress(status.id) : undefined;

    // Up to two names in bold, then "and N others" with the action
    const shown = group.accounts.slice(0, group.count > 2 ? 2 : group.count);
    const others = group.count - shown.length;
    const actors = actorsText(group.accounts.map(nameOf), group.count, i18n);
    const headline = (
        <Text style={styles.headlineText} numberOfLines={2}>
            {shown.map((person, index) => (
                <React.Fragment key={person.id}>
                    {index > 0 && (others > 0
                        ? <Text style={[type.name, styles.displayName]}>, </Text>
                        : <Text style={[type.body, styles.action]}> {t('common.and')} </Text>)}
                    {renderTextWithEmojis(nameOf(person), person.emojis || [], [type.name, styles.displayName], 16)}
                </React.Fragment>
            ))}
            <Text style={[type.body, styles.action]}>
                {others > 0 ? ` ${t('common.and')} ${tn('common.others', others)}` : ''} {action}
            </Text>
        </Text>
    );
    // The avatar opens the (first) person's profile
    const avatar = (
        <Pressable
            onPress={account ? () => openAccount(account) : undefined}
            disabled={!account}
            accessibilityRole="link"
            accessibilityLabel={t('post.openProfile', { name })}
        >
            {shown.length > 1
                ? <StackedAvatars accounts={shown} badge={config.badge} />
                : <Avatar name={name} uri={account?.avatar} size={44} badge={config.badge} />}
        </Pressable>
    );

    if (group.type === 'follow' && account) {
        return (
            <View style={[styles.row, styles.rowCentered]}>
                {avatar}
                {/* The whole name block opens the new follower's profile */}
                <Pressable
                    onPress={() => openAccount(account)}
                    accessibilityRole="link"
                    accessibilityLabel={t('post.openProfile', { name })}
                    style={[styles.content, styles.followContent]}
                >
                    {headline}
                    <Text style={[type.meta, styles.handle]} numberOfLines={1}>@{account.acct} · {time}</Text>
                </Pressable>
                <FollowButton accountId={account.id} name={nameOf(account)} relationship={relationship} />
            </View>
        );
    }

    const text = status ? statusText(status, group.type, i18n) : '';
    const body = (
        <>
            <View style={styles.headline}>
                {headline}
                <Text style={[type.meta, styles.time]}>{time}</Text>
            </View>
            {group.type === 'mention' ? (
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
    const label = t(text ? 'notifications.rowWithText' : 'notifications.row', { actors, action, time, text });

    if (group.type === 'mention' && status) {
        // The row isn't one accessible element here, or screen readers couldn't reach Reply and Favourite;
        // the text block is its own button instead
        return (
            <Pressable onPress={openStatus} disabled={!openStatus} accessible={false} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                {avatar}
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
            {avatar}
            <View style={styles.content}>{body}</View>
        </Pressable>
    );
};

const Notifications = ({ onStatusPress }: NotificationsProps) => {
    const { colors, type } = useTheme();
    const i18n = useI18n();
    const { t } = i18n;
    const filters: SegmentOption<NotificationFilter>[] = FILTERS.map(value => ({ value, label: t(`notifications.${value}`) }));
    const styles = useThemedStyles(makeStyles);
    const queryClient = useQueryClient();
    const [activeFilter, setActiveFilter] = useState<NotificationFilter>('all');
    const [isPullRefreshing, setIsPullRefreshing] = useState(false);
    const [markedReadId, setMarkedReadId] = useState<string | null>(null);

    const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, refetch } = useNotifications(activeFilter);

    // The server already filters by type; this guards against types the screen can't render
    const notifications = useMemo(
        () => mergeGroups(data?.pages.flatMap(page => page.groups) ?? []).filter(g => SUPPORTED_NOTIFICATION_TYPES.includes(g.type)),
        [data]
    );
    const listItems = useMemo(() => buildListItems(notifications, new Date(), i18n), [notifications, i18n]);

    const followerIds = useMemo(
        () => notifications.filter(g => g.type === 'follow' && g.accounts[0]).map(g => g.accounts[0].id),
        [notifications]
    );
    const relationships = useRelationships(followerIds);

    // Newest notification across every loaded filter, so marking read from "Mentions" doesn't leave newer follows unread
    const newestId = useMemo(() => {
        const ids = queryClient
            .getQueriesData<InfiniteData<NotificationGroupsPage>>({ queryKey: ['notifications'] })
            .flatMap(([, cached]) => cached?.pages[0]?.groups.map(group => group.newestId) ?? [])
            .filter((id): id is string => !!id);
        return ids.reduce<string | null>((newest, id) => (!newest || isNewerId(id, newest) ? id : newest), null);
    }, [queryClient, data]);

    // Showing them counts as seeing them: the bell's dot goes away (the server's marker stays)
    const markSeen = useMarkNotificationsSeen();
    useEffect(() => {
        if (newestId) markSeen(newestId);
    }, [newestId, markSeen]);

    const handleMarkRead = async () => {
        if (!newestId) return;
        try {
            await markNotificationsRead(newestId);
            setMarkedReadId(newestId);
        } catch (error) {
            Alert.alert(t('common.error'), t('notifications.markReadFailed'));
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
                    group={item.group}
                    relationship={item.group.accounts[0] && relationships.get(item.group.accounts[0].id)}
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
                <Text style={[type.body, styles.emptyText]}>{t('notifications.empty')}</Text>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text accessibilityRole="header" style={[type.title, styles.title]}>{t('notifications.title')}</Text>
                <IconButton
                    icon="checkmark-done"
                    accessibilityLabel={t('notifications.markAllRead')}
                    onPress={handleMarkRead}
                    selected={allRead}
                    disabled={!newestId}
                    color={allRead ? colors.accentText : colors.textSecondary}
                    style={styles.markRead}
                />
            </View>
            <View style={styles.filters}>
                <SegmentedPill variant="chips" options={filters} value={activeFilter} onChange={setActiveFilter} />
            </View>
            {isLoading && notifications.length === 0 ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size={'large'} color={colors.accentColor} />
                </View>
            ) : (
                <FlashList
                    data={listItems}
                    keyExtractor={(item) => item.key}
                    getItemType={(item) => (item.kind === 'section' ? 'section' : `${item.group.type}${item.group.count > 1 ? '-grouped' : ''}`)}
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
