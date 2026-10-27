import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, Text, View, useWindowDimensions } from 'react-native';
import { FlashList, useRecyclingState } from '@shopify/flash-list';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { InfiniteData, useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Account, Notification, NotificationGroup, Relationship, Status } from '../../services/mastodon/types';
import { NotificationGroupsPage, clearNotifications, dismissNotificationGroup, isNewerId, mergeGroups } from '../../services/mastodon/notifications';
import { ActionSheet } from '../../components/ComposeModal/optionSheet';
import { favouriteStatus, unfavouriteStatus } from '../../services/mastodon/statuses';
import { markNotificationsRead } from '../../services/mastodon/markers';
import { useTheme } from '../../services/themeContext';
import { useCompose } from '../../services/composeContext';
import { renderTextWithEmojis } from '../../services/emojiHelper';
import { NotificationFilter, SUPPORTED_NOTIFICATION_TYPES, useNotifications } from '../../hooks/useNotifications';
import { useRelationships } from '../../hooks/useRelationships';
import { authorizeFollowRequest, rejectFollowRequest } from '../../services/mastodon/accounts';
import { useOptionalAuth } from '../../services/authContext';
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
import { dialog } from '../../services/dialog';
import { useMediaViewer } from '../../components/MediaViewer/mediaViewer';
import { FocusedImage } from '../../components/TootCard/focusedImage';
import { mediaLabel } from '../../components/TootCard/tootCard';
import { useReadDirectMentions } from '../../hooks/useConversations';

interface NotificationsProps {
    onStatusPress?: (id: string) => void;
}

const FILTERS: NotificationFilter[] = ['all', 'mentions', 'follows'];

// Types share the accent and differ by glyph and wording
const TYPE_CONFIG: Record<string, { badge: React.ComponentProps<typeof Ionicons>['name']; action: TKey }> = {
    mention: { badge: 'at', action: 'notifications.mention' },
    // A mention in a direct post
    privateMention: { badge: 'lock-closed', action: 'notifications.privateMention' },
    favourite: { badge: 'star', action: 'notifications.favourite' },
    reblog: { badge: 'repeat', action: 'notifications.reblog' },
    follow: { badge: 'person-add', action: 'notifications.follow' },
    quote: { badge: 'chatbox-ellipses', action: 'notifications.quote' },
    // The post attached is your quote; the post it quotes was edited
    quoted_update: { badge: 'create', action: 'notifications.quotedUpdate' },
    // Someone you turned the bell on for posted
    status: { badge: 'notifications', action: 'notifications.status' },
    update: { badge: 'create', action: 'notifications.update' },
    follow_request: { badge: 'person-add', action: 'notifications.followRequest' },
    poll: { badge: 'stats-chart', action: 'notifications.pollEnded' },
};

// Accept or turn down someone who asked to follow your locked account; the answer stays on the row
const FollowRequestActions = ({ account }: { account: Account }) => {
    const { t } = useI18n();
    const styles = useThemedStyles(makeStyles);
    const { type } = useTheme();
    const queryClient = useQueryClient();
    const [answer, setAnswer] = useRecyclingState<'accepted' | 'rejected' | 'pending' | null>(null, [account.id]);

    const respond = async (accept: boolean) => {
        setAnswer('pending');
        try {
            await (accept ? authorizeFollowRequest(account.id) : rejectFollowRequest(account.id));
            setAnswer(accept ? 'accepted' : 'rejected');
            queryClient.invalidateQueries({ queryKey: ['relationships'] });
        } catch (error) {
            console.warn('Answering the follow request failed:', error);
            setAnswer(null);
            dialog.toast(t('notifications.followRequestFailed'));
        }
    };

    if (answer === 'accepted' || answer === 'rejected') {
        return <Text style={[type.meta, styles.handle]}>{t(answer === 'accepted' ? 'notifications.accepted' : 'notifications.rejected')}</Text>;
    }
    return (
        <View style={styles.requestActions}>
            <PillButton label={t('notifications.accept')} size="small" disabled={answer === 'pending'} onPress={() => respond(true)} />
            <PillButton label={t('notifications.reject')} size="small" variant="ghost" disabled={answer === 'pending'} onPress={() => respond(false)} />
        </View>
    );
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
            dialog.toast(t('notifications.favouriteFailed'));
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

// A mention's pictures and videos as small thumbnails, so a reply that's only a picture isn't just a name.
// Tapping one opens the viewer; sensitive ones stay blurred.
const MediaThumbnails = ({ status, onOpenPost }: { status: Status; onOpenPost?: () => void }) => {
    const styles = useThemedStyles(makeStyles);
    const i18n = useI18n();
    const { openMedia } = useMediaViewer();
    const attachments = status.media_attachments ?? [];
    const visual = attachments.filter(attachment => attachment.type !== 'unknown');
    if (!visual.length) return null;
    return (
        <View style={styles.thumbnails}>
            {visual.map(attachment => {
                const index = attachments.indexOf(attachment);
                return (
                    <Pressable
                        key={attachment.id}
                        onPress={() => openMedia(attachments, index, onOpenPost)}
                        accessibilityRole="imagebutton"
                        accessibilityLabel={mediaLabel(attachment, index, attachments.length, i18n)}
                        style={styles.thumbnail}
                    >
                        <FocusedImage attachment={attachment} style={styles.thumbnailImage} blurred={status.sensitive} />
                    </Pressable>
                );
            })}
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
    // Holding a row starts picking notifications to remove, with this one ticked
    onLongPress?: () => void;
}

const NotificationRow = ({ group, relationship, onStatusPress, onLongPress }: NotificationRowProps) => {
    const { type } = useTheme();
    const styles = useThemedStyles(makeStyles);
    const i18n = useI18n();
    const { t, tn } = i18n;
    const { openAccount } = useOpenAccount();
    const me = useOptionalAuth()?.user;
    const { status } = group;
    const config = TYPE_CONFIG[group.type === 'mention' && status?.visibility === 'direct' ? 'privateMention' : group.type];
    const action = t(config.action);
    const account = group.accounts[0];
    const name = account ? nameOf(account) : '';
    const time = notificationTime(group.created_at, new Date(), i18n);
    const openStatus = status && onStatusPress ? () => onStatusPress(status.id) : undefined;

    // Up to two names in bold, then "and N others" with the action
    const shown = group.accounts.slice(0, group.count > 2 ? 2 : group.count);
    const others = group.count - shown.length;
    const actors = actorsText(group.accounts.map(nameOf), group.count, i18n);
    // "Your poll has ended" / "A poll you voted in has ended": no names first, they don't read well in Portuguese
    const pollSentence = group.type === 'poll' && t(account && account.id === me?.id ? 'notifications.ownPollEnded' : 'notifications.pollEnded');
    const headline = pollSentence ? (
        <Text style={[type.body, styles.action, styles.headlineText]} numberOfLines={2}>{pollSentence}</Text>
    ) : (
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
            onLongPress={onLongPress}
            disabled={!account}
            accessibilityRole="link"
            accessibilityLabel={t('post.openProfile', { name })}
        >
            {shown.length > 1
                ? <StackedAvatars accounts={shown} badge={config.badge} />
                : <Avatar name={name} uri={account?.avatar} size={44} badge={config.badge} />}
        </Pressable>
    );

    if ((group.type === 'follow' || group.type === 'follow_request') && account) {
        return (
            <View style={[styles.row, styles.rowCentered]}>
                {avatar}
                {/* The whole name block opens the new follower's profile */}
                <Pressable
                    onPress={() => openAccount(account)}
                    onLongPress={onLongPress}
                    accessibilityRole="link"
                    accessibilityLabel={t('post.openProfile', { name })}
                    style={[styles.content, styles.followContent]}
                >
                    {headline}
                    <Text style={[type.meta, styles.handle]} numberOfLines={1}>@{account.acct} · {time}</Text>
                </Pressable>
                {group.type === 'follow_request'
                    ? <FollowRequestActions account={account} />
                    : <FollowButton accountId={account.id} name={nameOf(account)} relationship={relationship} />}
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
                <>
                    {!!text && renderTextWithEmojis(text, status?.emojis || [], [type.body, styles.mentionText])}
                    {status && <MediaThumbnails status={status} onOpenPost={openStatus} />}
                </>
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
    const label = t(text ? 'notifications.rowWithText' : 'notifications.row', {
        actors: pollSentence ? '' : actors,
        action: pollSentence || action,
        time,
        text,
    }).trim();

    if (group.type === 'mention' && status) {
        // The row isn't one accessible element here, or screen readers couldn't reach Reply and Favourite;
        // the text block is its own button instead
        return (
            <Pressable onPress={openStatus} onLongPress={onLongPress} disabled={!openStatus && !onLongPress} accessible={false} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                {avatar}
                <View style={styles.content}>
                    <Pressable onPress={openStatus} onLongPress={onLongPress} disabled={!openStatus && !onLongPress} accessibilityRole="button" accessibilityLabel={label} style={styles.stack}>
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
            onLongPress={onLongPress}
            disabled={!openStatus && !onLongPress}
            accessibilityRole={openStatus ? 'button' : undefined}
            accessibilityLabel={label}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
            {avatar}
            <View style={styles.content}>{body}</View>
        </Pressable>
    );
};

// Behind a row swiped to the right: letting go past it removes the notification
const RemoveAction = () => {
    const { colors, type } = useTheme();
    const styles = useThemedStyles(makeStyles);
    const { t } = useI18n();
    return (
        <View style={styles.removeAction}>
            <Ionicons name="trash-outline" size={20} color={colors.cardBackground} />
            <Text style={[type.label, styles.removeText]}>{t('notifications.remove')}</Text>
        </View>
    );
};

// Card-toss timing: the row flies off while the swipe finishes, then the gap closes
const FLY_MS = 220;
const COLLAPSE_MS = 200;

// A row swiped most of the way to the right flies off, tilting and fading, then its space closes and
// only then it leaves the list, so the rows below slide up instead of jumping
const SwipeToRemove = ({ threshold, onRemove, children }: { threshold: number; onRemove: () => void; children: React.ReactNode }) => {
    const styles = useThemedStyles(makeStyles);
    const flying = useSharedValue(0);
    const height = useSharedValue(-1);
    const measured = useRef(0);
    const card = useAnimatedStyle(() => ({
        opacity: 1 - flying.value * 0.7,
        transform: [{ rotate: `${flying.value * 8}deg` }, { translateY: -flying.value * 16 }],
    }));
    const cell = useAnimatedStyle(() => (height.value < 0 ? {} : { height: height.value, overflow: 'hidden' }));
    const collapse = () => {
        height.value = measured.current;
        height.value = withTiming(0, { duration: COLLAPSE_MS }, finished => {
            if (finished) runOnJS(onRemove)();
        });
    };
    return (
        <Animated.View style={cell} onLayout={event => (measured.current = event.nativeEvent.layout.height)}>
            <ReanimatedSwipeable
                renderLeftActions={() => <RemoveAction />}
                // Removes only when dragged most of the way across, and only after a clear sideways drag
                leftThreshold={threshold}
                dragOffsetFromLeftEdge={24}
                overshootLeft={false}
                animationOptions={{ duration: FLY_MS }}
                onSwipeableWillOpen={() => {
                    flying.value = withTiming(1, { duration: FLY_MS });
                }}
                onSwipeableOpen={collapse}
            >
                <Animated.View style={[styles.swipeRow, card]}>{children}</Animated.View>
            </ReanimatedSwipeable>
        </Animated.View>
    );
};

// A row while picking which to remove: tapping it ticks it, its buttons and links rest
const SelectableRow = ({ group, selected, onToggle, children }: { group: NotificationGroup; selected: boolean; onToggle: () => void; children: React.ReactNode }) => {
    const { colors } = useTheme();
    const styles = useThemedStyles(makeStyles);
    const i18n = useI18n();
    const label = `${actorsText(group.accounts.map(nameOf), group.count, i18n)} ${i18n.t(TYPE_CONFIG[group.type].action)}`;
    return (
        <Pressable
            onPress={onToggle}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={label}
            style={[styles.selectable, selected && styles.selectableOn]}
        >
            <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={selected ? colors.accentText : colors.textMuted} />
            <View style={styles.selectableContent} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                {children}
            </View>
        </Pressable>
    );
};

const Notifications = ({ onStatusPress }: NotificationsProps) => {
    const { colors, type } = useTheme();
    const i18n = useI18n();
    const { t, tn } = i18n;
    const filters: SegmentOption<NotificationFilter>[] = FILTERS.map(value => ({ value, label: t(`notifications.${value}`) }));
    const styles = useThemedStyles(makeStyles);
    const queryClient = useQueryClient();
    const [activeFilter, setActiveFilter] = useState<NotificationFilter>('all');
    const [isPullRefreshing, setIsPullRefreshing] = useState(false);
    const [markedReadId, setMarkedReadId] = useState<string | null>(null);
    // Picking notifications to remove: the keys of the ticked rows
    const [selecting, setSelecting] = useState(false);
    const [selected, setSelected] = useState<Set<string>>(() => new Set());
    const [clearMenuOpen, setClearMenuOpen] = useState(false);
    const removeThreshold = useWindowDimensions().width * 0.65;

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
    // Direct messages read here clear the envelope's dot too
    const directMentionIds = useMemo(
        () => notifications.flatMap(group => (group.type === 'mention' && group.status?.visibility === 'direct' ? [group.status.id] : [])),
        [notifications]
    );
    useReadDirectMentions(directMentionIds);

    const handleMarkRead = async () => {
        if (!newestId) return;
        try {
            await markNotificationsRead(newestId);
            setMarkedReadId(newestId);
        } catch (error) {
            dialog.toast(t('notifications.markReadFailed'));
        }
    };
    const allRead = !!newestId && markedReadId === newestId;

    // Removed rows go at once, from every filter's list; a failure brings them back with a refetch
    const removeFromCache = useCallback(
        (keys: Set<string>) =>
            queryClient.setQueriesData<InfiniteData<NotificationGroupsPage>>({ queryKey: ['notifications'] }, cached =>
                cached && { ...cached, pages: cached.pages.map(page => ({ ...page, groups: page.groups.filter(group => !keys.has(group.key)) })) }
            ),
        [queryClient]
    );

    const removeOne = async (group: NotificationGroup) => {
        removeFromCache(new Set([group.key]));
        try {
            await dismissNotificationGroup(group);
        } catch (error) {
            dialog.toast(t('notifications.removeFailed'));
            refetch();
        }
    };

    const startSelecting = (key: string) => {
        setSelected(new Set([key]));
        setSelecting(true);
    };
    const stopSelecting = () => {
        setSelecting(false);
        setSelected(new Set());
    };
    const toggle = (key: string) =>
        setSelected(current => {
            const next = new Set(current);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });

    // Removing deletes them from the account, in every app, so it asks first
    const removeSelected = () =>
        dialog.alert(tn('notifications.removeSelectedTitle', selected.size), t('notifications.removeSelectedMessage'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
                text: t('notifications.remove'),
                style: 'destructive',
                onPress: async () => {
                    const groups = notifications.filter(group => selected.has(group.key));
                    const results = await Promise.allSettled(groups.map(dismissNotificationGroup));
                    const removed = new Set(groups.filter((_, index) => results[index].status === 'fulfilled').map(group => group.key));
                    removeFromCache(removed);
                    const failed = groups.length - removed.size;
                    dialog.toast(failed > 0 ? tn('notifications.removeSelectedFailed', failed) : tn('notifications.removedSelected', removed.size));
                    stopSelecting();
                },
            },
        ]);

    // Clearing deletes them from the account (every app, not just pugdon), so it asks first
    const handleClear = () =>
        dialog.alert(t('notifications.clearTitle'), t('notifications.clearMessage'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
                text: t('notifications.clear'),
                style: 'destructive',
                onPress: async () => {
                    try {
                        await clearNotifications();
                        queryClient.setQueriesData<InfiniteData<NotificationGroupsPage>>({ queryKey: ['notifications'] }, cached =>
                            cached && { ...cached, pages: cached.pages.map(page => ({ ...page, groups: [] })) }
                        );
                        dialog.toast(t('notifications.cleared'));
                    } catch (error) {
                        dialog.toast(t('notifications.clearFailed'));
                    }
                },
            },
        ]);

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
        const row = (
            <NotificationRow
                group={item.group}
                relationship={item.group.accounts[0] && relationships.get(item.group.accounts[0].id)}
                onStatusPress={onStatusPress}
                onLongPress={selecting ? undefined : () => startSelecting(item.group.key)}
            />
        );
        return (
            <View style={[styles.segment, item.first && styles.segmentFirst, item.last && styles.segmentLast]}>
                {!item.first && <View style={styles.separator} />}
                {selecting ? (
                    <SelectableRow group={item.group} selected={selected.has(item.group.key)} onToggle={() => toggle(item.group.key)}>
                        {row}
                    </SelectableRow>
                ) : (
                    // Keyed by the notification so a recycled cell never comes back half swiped or collapsed
                    <SwipeToRemove key={item.group.key} threshold={removeThreshold} onRemove={() => removeOne(item.group)}>
                        {row}
                    </SwipeToRemove>
                )}
            </View>
        );
    };

    // Rows read follow state and the selection from outside `data`, so re-render them when either changes
    const rowState = useMemo(() => ({ relationships, selecting, selected }), [relationships, selecting, selected]);

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
            {selecting ? (
                <View style={styles.header}>
                    <PillButton label={t('common.cancel')} variant="ghost" size="small" onPress={stopSelecting} />
                    <Text accessibilityRole="header" style={[type.name, styles.title]}>{tn('notifications.selectedCount', selected.size)}</Text>
                    <PillButton
                        label={t('notifications.remove')}
                        icon="trash-outline"
                        variant="danger"
                        size="small"
                        onPress={removeSelected}
                        disabled={selected.size === 0}
                    />
                </View>
            ) : (
                <View style={styles.header}>
                    <Text accessibilityRole="header" style={[type.title, styles.title]}>{t('notifications.title')}</Text>
                    <View style={styles.headerActions}>
                        <PillButton
                            label={t('notifications.clear')}
                            icon="trash-outline"
                            size="small"
                            variant="subtle"
                            onPress={() => setClearMenuOpen(true)}
                            disabled={notifications.length === 0}
                        />
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
                </View>
            )}
            <View style={styles.filters}>
                <SegmentedPill variant="chips" options={filters} value={activeFilter} onChange={filter => { setActiveFilter(filter); stopSelecting(); }} />
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
                    extraData={rowState}
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
            <ActionSheet
                visible={clearMenuOpen}
                title={t('notifications.clearMenuTitle')}
                onClose={() => setClearMenuOpen(false)}
                actions={[
                    { key: 'select', icon: 'checkmark-circle-outline', label: t('notifications.select'), onPress: () => setSelecting(true) },
                    { key: 'clearAll', icon: 'trash-outline', label: t('notifications.clearAllAction'), description: t('notifications.clearAllHint'), onPress: handleClear },
                ]}
            />
        </View>
    );
};

export default Notifications;
