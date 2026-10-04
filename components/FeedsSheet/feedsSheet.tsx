import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../services/themeContext';
import { useI18n } from '../../services/i18n/i18nContext';
import { usePinnedFeeds } from '../../hooks/usePinnedFeeds';
import { createHashtagFeed, createListFeed, describeCriteria, FeedDescriptor, feedIcon, feedLabel, TRENDING_FEED } from '../../services/mastodon/feedTypes';
import { useLists } from '../../hooks/useLists';
import { radii, space } from '../../services/theme/shape';
import { IconButton, PillButton, SectionLabel } from '../ui';
import { BottomSheet } from '../ComposeModal/optionSheet';

interface FeedsSheetProps {
    visible: boolean;
    onClose: () => void;
    // Opens a feed (closing the sheet)
    onSelectFeed: (feed: FeedDescriptor) => void;
    // Opens the screen to make a new hashtag feed
    onCreateFeed: () => void;
    // Opens the list editor: an existing list, or a new one without an id
    onEditList: (listId?: string) => void;
    // Opens the screen to add another server's timeline
    onAddServer: () => void;
}

// Every feed you can pin above the timeline: what's pinned, trending posts, lists, followed hashtags,
// your own hashtag feeds and other servers' timelines. Tapping a row opens that feed; the pill on the right pins or unpins it.
export const FeedsSheet: React.FC<FeedsSheetProps> = ({ visible, onClose, onSelectFeed, onCreateFeed, onEditList, onAddServer }) => {
    const { colors, type } = useTheme();
    const i18n = useI18n();
    const { t } = i18n;
    const { pinnedFeeds, customFeeds, followedTags, pinFeed, unpinFeed, removeCustomFeed, isPinned } = usePinnedFeeds();
    const { data: lists } = useLists(visible);

    const open = (feed: FeedDescriptor) => {
        onSelectFeed(feed);
        onClose();
    };

    const row = (feed: FeedDescriptor, options: { subtitle?: string; onDelete?: () => void; onEdit?: () => void } = {}) => {
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
                        <Ionicons name={feedIcon(feed.kind)} size={18} color={colors.accentText} />
                    </View>
                    <View style={styles.rowText}>
                        <Text style={[type.name, { color: colors.textPrimary }]} numberOfLines={1}>{label}</Text>
                        {!!options.subtitle && (
                            <Text style={[type.meta, { color: colors.textMuted }]} numberOfLines={1}>{options.subtitle}</Text>
                        )}
                    </View>
                </Pressable>
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

    // A dashed "make something new" row
    const createButton = (title: string, subtitle: string, onPress: () => void) => (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={title}
            style={({ pressed }) => [styles.create, { borderColor: colors.borderColor }, pressed && { opacity: 0.7 }]}
        >
            <Ionicons name="add-circle-outline" size={20} color={colors.accentText} />
            <View style={styles.rowText}>
                <Text style={[type.name, { color: colors.accentText }]}>{title}</Text>
                <Text style={[type.meta, { color: colors.textMuted }]}>{subtitle}</Text>
            </View>
        </Pressable>
    );

    // Each followed hashtag as a feed of its own
    const tagFeeds = followedTags.map(tag => createHashtagFeed(tag.name));
    // Server feeds live only as pins: unpinning one removes it
    const serverFeeds = pinnedFeeds.filter(feed => feed.kind === 'server');
    const subtitleFor = (feed: FeedDescriptor) => {
        if (feed.kind === 'hashtag') return describeCriteria(feed.criteria);
        if (feed.kind === 'server') return t('servers.localTimeline', { domain: feed.domain ?? '' });
        return undefined;
    };

    return (
        <BottomSheet visible={visible} title={t('feeds.title')} onClose={onClose}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <SectionLabel style={styles.section}>{t('feeds.pinned')}</SectionLabel>
                {pinnedFeeds.map(feed => row(feed, { subtitle: subtitleFor(feed) }))}

                <SectionLabel style={styles.section}>{t('feeds.discover')}</SectionLabel>
                {row(TRENDING_FEED, { subtitle: t('feeds.trendingSubtitle') })}

                <SectionLabel style={styles.section}>{t('lists.title')}</SectionLabel>
                {lists && lists.length === 0 && (
                    <Text style={[type.meta, styles.empty, { color: colors.textMuted }]}>{t('lists.none')}</Text>
                )}
                {lists?.map(list => row(createListFeed(list), { onEdit: () => edit(list.id) }))}
                {createButton(t('lists.newList'), t('lists.newListSubtitle'), () => edit())}

                <SectionLabel style={styles.section}>{t('feeds.followedTags')}</SectionLabel>
                {tagFeeds.length === 0 ? (
                    <Text style={[type.meta, styles.empty, { color: colors.textMuted }]}>{t('feeds.noFollowedTags')}</Text>
                ) : (
                    tagFeeds.map(feed => row(feed))
                )}

                <SectionLabel style={styles.section}>{t('feeds.customFeeds')}</SectionLabel>
                {customFeeds.map(feed => row(feed, { subtitle: describeCriteria(feed.criteria), onDelete: () => removeCustomFeed(feed.id) }))}
                {createButton(t('feeds.createCustom'), t('feeds.createCustomSubtitle'), () => {
                    onClose();
                    onCreateFeed();
                })}

                <SectionLabel style={styles.section}>{t('servers.title')}</SectionLabel>
                {serverFeeds.map(feed => row(feed, { subtitle: subtitleFor(feed) }))}
                {createButton(t('servers.add'), t('servers.addSubtitle'), () => {
                    onClose();
                    onAddServer();
                })}
            </ScrollView>
        </BottomSheet>
    );
};

const styles = StyleSheet.create({
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
