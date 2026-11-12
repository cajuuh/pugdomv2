import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Icon } from '../ui/icon';
import { useTheme } from '../../services/themeContext';
import { useI18n } from '../../services/i18n/i18nContext';
import { usePinnedFeeds } from '../../hooks/usePinnedFeeds';
import { createHashtagFeed, createListFeed, describeCriteria, FeedDescriptor, feedIcon, feedLabel, TRENDING_FEED } from '../../services/mastodon/feedTypes';
import { useLists } from '../../hooks/useLists';
import { radii, space } from '../../services/theme/shape';
import { IconButton, PillButton, SectionLabel } from '../ui';
import { BottomSheet } from '../ComposeModal/optionSheet';
import { dialog } from '../../services/dialog';
import { PinnedRows } from './pinnedRows';

interface FeedsSheetProps {
    visible: boolean;
    onClose: () => void;
    // Opens a feed (closing the sheet)
    onSelectFeed: (feed: FeedDescriptor) => void;
    // Opens the hashtag feed editor: an existing feed, or a new one without a feed
    onEditFeed: (feed?: FeedDescriptor) => void;
    // Opens the list editor: an existing list, or a new one without an id
    onEditList: (listId?: string) => void;
    // Opens the screen to add another server's timeline
    onAddServer: () => void;
}

// Every feed you can pin above the timeline: what's pinned, trending posts, lists, followed hashtags,
// your own hashtag feeds and other servers' timelines. Tapping a row opens that feed; the pill on the right pins or unpins it.
export const FeedsSheet: React.FC<FeedsSheetProps> = ({ visible, onClose, onSelectFeed, onEditFeed, onEditList, onAddServer }) => {
    const { colors, type } = useTheme();
    const i18n = useI18n();
    const { t } = i18n;
    const { pinnedFeeds, customFeeds, followedTags, pinFeed, unpinFeed, movePinnedFeed, unfollowHashtag, removeCustomFeed, isPinned } = usePinnedFeeds();
    const { data: lists } = useLists(visible);
    const [dragging, setDragging] = useState(false);

    // By id: this render's indexes can be one tap behind the saved order
    const move = (from: number, to: number) => movePinnedFeed(pinnedFeeds[from].id, to - from);

    const confirmUnfollow = (name: string) =>
        dialog.alert(t('hashtag.unfollowTitle'), undefined, [
            { text: t('hashtag.keep'), style: 'cancel' },
            {
                text: t('hashtag.unfollow'),
                style: 'destructive',
                onPress: () => {
                    unfollowHashtag(name).catch(() => dialog.toast(t('hashtag.followFailed')));
                },
            },
        ], { subtitle: `#${name}` });

    const open = (feed: FeedDescriptor) => {
        onSelectFeed(feed);
        onClose();
    };

    const row = (feed: FeedDescriptor, options: { subtitle?: string; onDelete?: () => void; onEdit?: () => void; onUnfollow?: () => void; index?: number } = {}) => {
        const label = feedLabel(feed, i18n);
        const pinned = isPinned(feed.id);
        return (
            <View key={feed.id} style={styles.row}>
                <Pressable
                    onPress={() => open(feed)}
                    accessibilityRole="button"
                    accessibilityLabel={t('feeds.openFeed', { feed: label })}
                    style={({ pressed }) => [styles.rowMain, pressed && { opacity: 0.7 }]}
                >
                    <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
                        <Icon name={feedIcon(feed.kind)} size={18} color={colors.accentText} />
                    </View>
                    <View style={styles.rowText}>
                        <Text style={[type.name, { color: colors.textPrimary }]} numberOfLines={1}>{label}</Text>
                        {!!options.subtitle && (
                            <Text style={[type.meta, { color: colors.textMuted }]} numberOfLines={1}>{options.subtitle}</Text>
                        )}
                    </View>
                </Pressable>
                {options.index !== undefined && (
                    <>
                        <IconButton
                            icon="chevron-up"
                            size={18}
                            color={colors.textMuted}
                            accessibilityLabel={t('feeds.moveUp', { feed: label })}
                            disabled={options.index === 0}
                            onPress={() => move(options.index!, options.index! - 1)}
                            style={styles.arrow}
                        />
                        <IconButton
                            icon="chevron-down"
                            size={18}
                            color={colors.textMuted}
                            accessibilityLabel={t('feeds.moveDown', { feed: label })}
                            disabled={options.index === pinnedFeeds.length - 1}
                            onPress={() => move(options.index!, options.index! + 1)}
                            style={styles.arrow}
                        />
                    </>
                )}
                {options.onUnfollow && (
                    <IconButton icon="remove-circle-outline" size={18} color={colors.textMuted} accessibilityLabel={t('feeds.unfollowTag', { feed: label })} onPress={options.onUnfollow} />
                )}
                {options.onEdit && (
                    <IconButton icon="create-outline" size={18} color={colors.textMuted} accessibilityLabel={t('lists.editListLabel', { list: label })} onPress={options.onEdit} />
                )}
                {options.onDelete && (
                    <IconButton icon="trash-outline" size={18} color={colors.textMuted} accessibilityLabel={t('feeds.deleteFeed', { feed: label })} onPress={options.onDelete} />
                )}
                {feed.canUnpin === false ? (
                    <Text style={[type.meta, { color: colors.textMuted }]}>{t('feeds.alwaysPinned')}</Text>
                ) : (
                    <PillButton
                        label={pinned ? t('feeds.unpin') : t('feeds.pin')}
                        icon={pinned ? 'checkmark' : 'add'}
                        size="small"
                        variant={pinned ? 'secondary' : 'primary'}
                        onPress={() => (pinned ? unpinFeed(feed.id) : pinFeed(feed))}
                    />
                )}
            </View>
        );
    };

    const edit = (listId?: string) => {
        onClose();
        onEditList(listId);
    };

    const editFeed = (feed?: FeedDescriptor) => {
        onClose();
        onEditFeed(feed);
    };

    // A dashed "make something new" row
    const createButton = (title: string, subtitle: string, onPress: () => void) => (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={title}
            style={({ pressed }) => [styles.create, { borderColor: colors.borderColor }, pressed && { opacity: 0.7 }]}
        >
            <Icon name="add-circle-outline" size={20} color={colors.accentText} />
            <View style={styles.rowText}>
                <Text style={[type.name, { color: colors.accentText }]}>{title}</Text>
                <Text style={[type.meta, { color: colors.textMuted }]}>{subtitle}</Text>
            </View>
        </Pressable>
    );

    // Server feeds live only as pins: unpinning one removes it
    const serverFeeds = pinnedFeeds.filter(feed => feed.kind === 'server');
    const subtitleFor = (feed: FeedDescriptor) => {
        if (feed.kind === 'hashtag') return describeCriteria(feed.criteria);
        if (feed.kind === 'server') return t('servers.localTimeline', { domain: feed.domain ?? '' });
        return undefined;
    };

    return (
        <BottomSheet visible={visible} title={t('feeds.title')} onClose={onClose}>
            {/* A Modal is its own native window, so gestures inside it need their own root */}
            <GestureHandlerRootView style={styles.gestureRoot}>
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} scrollEnabled={!dragging}>
                    <SectionLabel style={styles.section}>{t('feeds.pinned')}</SectionLabel>
                    {pinnedFeeds.length > 1 && <Text style={[type.meta, styles.empty, { color: colors.textMuted }]}>{t('feeds.reorderHint')}</Text>}
                    <PinnedRows
                        feeds={pinnedFeeds}
                        renderRow={(feed, index) => row(feed, { subtitle: subtitleFor(feed), index })}
                        onMove={move}
                        onDragChange={setDragging}
                    />

                    <SectionLabel style={styles.section}>{t('feeds.discover')}</SectionLabel>
                    {row(TRENDING_FEED, { subtitle: t('feeds.trendingSubtitle') })}

                    <SectionLabel style={styles.section}>{t('lists.title')}</SectionLabel>
                    {lists && lists.length === 0 && (
                        <Text style={[type.meta, styles.empty, { color: colors.textMuted }]}>{t('lists.none')}</Text>
                    )}
                    {lists?.map(list => row(createListFeed(list), { onEdit: () => edit(list.id) }))}
                    {createButton(t('lists.newList'), t('lists.newListSubtitle'), () => edit())}

                    <SectionLabel style={styles.section}>{t('feeds.followedTags')}</SectionLabel>
                    {followedTags.length === 0 ? (
                        <Text style={[type.meta, styles.empty, { color: colors.textMuted }]}>{t('feeds.noFollowedTags')}</Text>
                    ) : (
                        followedTags.map(tag => row(createHashtagFeed(tag.name), { onUnfollow: () => confirmUnfollow(tag.name) }))
                    )}

                    <SectionLabel style={styles.section}>{t('feeds.customFeeds')}</SectionLabel>
                    {customFeeds.map(feed => row(feed, { subtitle: describeCriteria(feed.criteria), onEdit: () => editFeed(feed), onDelete: () => removeCustomFeed(feed.id) }))}
                    {createButton(t('feeds.createCustom'), t('feeds.createCustomSubtitle'), () => editFeed())}

                    <SectionLabel style={styles.section}>{t('servers.title')}</SectionLabel>
                    {serverFeeds.map(feed => row(feed, { subtitle: subtitleFor(feed) }))}
                    {createButton(t('servers.add'), t('servers.addSubtitle'), () => {
                        onClose();
                        onAddServer();
                    })}
                </ScrollView>
            </GestureHandlerRootView>
        </BottomSheet>
    );
};

const styles = StyleSheet.create({
    gestureRoot: {
        flexShrink: 1,
    },
    // Narrower than the usual touch width, to leave the feed's name some room; still full height
    arrow: {
        minWidth: 32,
    },
    content: {
        paddingBottom: space.md,
    },
    section: {
        marginTop: space.md,
        marginBottom: space.xs,
        marginHorizontal: space.xs,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        paddingVertical: space.xs,
    },
    rowMain: {
        flex: 1,
        minWidth: 0,
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
    },
    icon: {
        width: 36,
        height: 36,
        borderRadius: radii.pill,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowText: {
        flex: 1,
        minWidth: 0,
    },
    empty: {
        marginHorizontal: space.xs,
        marginBottom: space.sm,
    },
    create: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        minHeight: 52,
        marginTop: space.sm,
        paddingHorizontal: space.md,
        borderRadius: radii.input,
        borderWidth: StyleSheet.hairlineWidth,
        borderStyle: 'dashed',
    },
});
