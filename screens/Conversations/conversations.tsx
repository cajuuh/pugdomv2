import React, { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useTheme } from '../../services/themeContext';
import { useI18n } from '../../services/i18n/i18nContext';
import { ConversationGroup, groupConversations, statusPreview } from '../../services/mastodon/conversations';
import { useConversations } from '../../hooks/useConversations';
import { renderTextWithEmojis } from '../../services/emojiHelper';
import { radii, space } from '../../services/theme/shape';
import { TAB_BAR_CLEARANCE } from '../../components/TabBar/styles';
import { getRelativeTime } from '../../components/TootCard/tootCard';
import { Avatar, IconButton, PillButton, SegmentOption, SegmentedPill } from '../../components/ui';
import { dialog } from '../../services/dialog';

interface ConversationsProps {
    onBack: () => void;
    onStatusPress: (id: string) => void;
    // A person you have several threads with: their own screen
    onGroupPress: (groupKey: string) => void;
}

type Filter = 'all' | 'unread';

// Answers from a server that has no way to mark a conversation read
const UNSUPPORTED = [404, 405, 501];

// Your direct conversations, one row per person (or group of people), newest activity first. Opening a person
// with one thread marks it read and shows it; with several, their threads. Unread lists only the unread ones,
// and Mark all as read clears them (Mastodon can't mark them unread again).
const Conversations = ({ onBack, onStatusPress, onGroupPress }: ConversationsProps) => {
    const { colors, type } = useTheme();
    const i18n = useI18n();
    const { t, tn } = i18n;
    const insets = useSafeAreaInsets();
    const { query, conversations, markRead, open, me } = useConversations();
    const { isLoading, hasNextPage, fetchNextPage, isFetchingNextPage, refetch, isRefetching } = query;
    const unreadIds = conversations.filter(conversation => conversation.unread).map(conversation => conversation.id);
    // Older threads with someone join their row as their page loads
    const groups = groupConversations(conversations);
    const [filter, setFilter] = useState<Filter>('all');
    const [markingAll, setMarkingAll] = useState(false);
    const filters: SegmentOption<Filter>[] = [
        { value: 'all', label: t('conversations.all') },
        { value: 'unread', label: t('conversations.unreadFilter') },
    ];
    const shown = filter === 'unread' ? groups.filter(group => group.unread) : groups;

    const markAllRead = async () => {
        setMarkingAll(true);
        const failed = await markRead(unreadIds);
        setMarkingAll(false);
        if (!failed.length) return;
        const unsupported = failed.every(item => item.status !== undefined && UNSUPPORTED.includes(item.status));
        dialog.toast(unsupported ? t('conversations.markReadUnsupported') : tn('conversations.markAllReadFailed', failed.length));
    };

    const openGroup = (group: ConversationGroup) =>
        group.threads.length === 1 ? open(group.threads[0], onStatusPress) : onGroupPress(group.key);

    const renderRow = ({ item }: { item: ConversationGroup }) => {
        const people = item.people;
        const names = people.map(account => account.display_name || account.username).join(', ');
        const last = item.threads[0].last_status;
        const text = last ? statusPreview(last) : '';
        const preview = last && last.account.id === me?.id ? t('conversations.you', { text }) : text;
        const threads = item.threads.length > 1 ? tn('conversations.threadCount', item.threads.length) : null;
        return (
            <Pressable
                onPress={() => openGroup(item)}
                accessibilityRole="button"
                accessibilityLabel={[names, threads, item.unread ? t('conversations.unread') : null, preview].filter(Boolean).join('. ')}
                style={({ pressed }) => [styles.row, { borderBottomColor: colors.borderColor }, pressed && { backgroundColor: colors.inputBackground }]}
            >
                <Avatar name={names} uri={people[0]?.avatar} size={44} />
                <View style={styles.rowText}>
                    <View style={styles.rowTop}>
                        <View style={styles.names}>
                            {renderTextWithEmojis(names, people.flatMap(account => account.emojis || []), [type.name, { color: colors.textPrimary }], 15)}
                        </View>
                        {last && <Text style={[type.meta, { color: colors.textMuted }]}>{getRelativeTime(last.created_at, i18n)}</Text>}
                        {item.unread && <View testID="conversation-unread" style={[styles.dot, { backgroundColor: colors.accentColor }]} />}
                    </View>
                    {threads && (
                        <View style={[styles.threadsChip, { backgroundColor: colors.accentSoft }]}>
                            <Text style={[type.meta, { color: colors.accentText }]}>{threads}</Text>
                        </View>
                    )}
                    <Text style={[type.body, { color: item.unread ? colors.textPrimary : colors.textSecondary }]} numberOfLines={2}>
                        {renderTextWithEmojis(preview, last?.emojis ?? [], [type.body, { color: item.unread ? colors.textPrimary : colors.textSecondary }], 14)}
                    </Text>
                </View>
            </Pressable>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.borderColor, backgroundColor: colors.cardBackground }]}>
                <IconButton icon="arrow-back" accessibilityLabel={t('common.goBack')} onPress={onBack} />
                <Text accessibilityRole="header" style={[type.name, styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                    {t('conversations.title')}
                </Text>
                <View style={styles.spacer} />
            </View>
            <View style={styles.filters}>
                <SegmentedPill variant="chips" options={filters} value={filter} onChange={setFilter} />
                {unreadIds.length > 0 && (
                    <PillButton
                        label={t('conversations.markAllRead')}
                        icon="checkmark-done"
                        variant="ghost"
                        size="small"
                        loading={markingAll}
                        onPress={markAllRead}
                    />
                )}
            </View>

            {isLoading ? (
                <ActivityIndicator style={styles.loading} color={colors.accentColor} />
            ) : (
                <FlashList
                    data={shown}
                    keyExtractor={item => item.key}
                    renderItem={renderRow}
                    contentContainerStyle={styles.list}
                    onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
                    onEndReachedThreshold={0.5}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefetching && !isFetchingNextPage}
                            onRefresh={refetch}
                            tintColor={colors.accentColor}
                            colors={[colors.accentColor]}
                            progressBackgroundColor={colors.cardBackground}
                        />
                    }
                    ListEmptyComponent={<Text style={[type.body, styles.empty, { color: colors.textMuted }]}>{t(filter === 'unread' ? 'conversations.noneUnread' : 'conversations.none')}</Text>}
                    ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={colors.accentColor} /> : null}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingBottom: space.sm,
        paddingHorizontal: space.lg,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    title: {
        flex: 1,
        textAlign: 'center',
    },
    spacer: {
        width: 44,
    },
    filters: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: space.sm,
        paddingTop: 14,
        paddingBottom: 6,
        paddingHorizontal: space.lg,
    },
    loading: {
        marginTop: space.xl,
    },
    list: {
        paddingBottom: TAB_BAR_CLEARANCE,
    },
    row: {
        flexDirection: 'row',
        gap: space.md,
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    rowText: {
        flex: 1,
        gap: 2,
    },
    rowTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
    },
    names: {
        flex: 1,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: radii.pill,
    },
    threadsChip: {
        alignSelf: 'flex-start',
        borderRadius: radii.pill,
        paddingHorizontal: space.sm,
        paddingVertical: 1,
        marginBottom: 2,
    },
    empty: {
        textAlign: 'center',
        marginTop: space.xl,
        paddingHorizontal: space.xl,
    },
});

export default Conversations;
