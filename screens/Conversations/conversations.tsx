import React from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { InfiniteData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../services/themeContext';
import { useI18n } from '../../services/i18n/i18nContext';
import { useOptionalAuth } from '../../services/authContext';
import { Conversation, ConversationsPage, getConversations, markConversationRead } from '../../services/mastodon/conversations';
import { unreadConversationsKey } from '../../hooks/useUnreadConversations';
import { renderTextWithEmojis } from '../../services/emojiHelper';
import { plainText } from '../../services/htmlText';
import { radii, space } from '../../services/theme/shape';
import { TAB_BAR_CLEARANCE } from '../../components/TabBar/styles';
import { getRelativeTime } from '../../components/TootCard/tootCard';
import { Avatar, IconButton } from '../../components/ui';

interface ConversationsProps {
    onBack: () => void;
    onStatusPress: (id: string) => void;
}

export const conversationsKey = (accountId: string) => ['conversations', accountId];

// Your direct conversations, newest activity first. Opening one marks it read and shows its thread.
const Conversations = ({ onBack, onStatusPress }: ConversationsProps) => {
    const { colors, type } = useTheme();
    const i18n = useI18n();
    const { t } = i18n;
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();
    const me = useOptionalAuth()?.user;
    const key = conversationsKey(me?.id ?? '');

    const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage, refetch, isRefetching } = useInfiniteQuery({
        queryKey: key,
        queryFn: ({ pageParam }) => getConversations(pageParam),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (page: ConversationsPage) => page.nextMaxId,
    });
    const conversations = data?.pages.flatMap(page => page.conversations) ?? [];

    const open = (conversation: Conversation) => {
        if (!conversation.last_status) return;
        if (conversation.unread) {
            // Read at once here; the envelope's dot checks again once the server agrees
            queryClient.setQueryData<InfiniteData<ConversationsPage>>(key, current =>
                current && {
                    ...current,
                    pages: current.pages.map(page => ({
                        ...page,
                        conversations: page.conversations.map(item => (item.id === conversation.id ? { ...item, unread: false } : item)),
                    })),
                }
            );
            markConversationRead(conversation.id)
                .catch(error => console.warn('Marking the conversation read failed:', error))
                .finally(() => queryClient.invalidateQueries({ queryKey: unreadConversationsKey(me?.id ?? '') }));
        }
        onStatusPress(conversation.last_status.id);
    };

    const renderRow = ({ item }: { item: Conversation }) => {
        const people = item.accounts.length ? item.accounts : item.last_status ? [item.last_status.account] : [];
        const names = people.map(account => account.display_name || account.username).join(', ');
        const last = item.last_status;
        const text = last ? (last.spoiler_text ? `⚠ ${last.spoiler_text}` : plainText(last.content).replace(/\s+/g, ' ')) : '';
        const preview = last && last.account.id === me?.id ? t('conversations.you', { text }) : text;
        return (
            <Pressable
                onPress={() => open(item)}
                accessibilityRole="button"
                accessibilityLabel={[names, item.unread ? t('conversations.unread') : null, preview].filter(Boolean).join('. ')}
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
                    <Text style={[type.body, { color: item.unread ? colors.textPrimary : colors.textSecondary }]} numberOfLines={2}>
                        {preview}
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

            {isLoading ? (
                <ActivityIndicator style={styles.loading} color={colors.accentColor} />
            ) : (
                <FlashList
                    data={conversations}
                    keyExtractor={item => item.id}
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
                    ListEmptyComponent={<Text style={[type.body, styles.empty, { color: colors.textMuted }]}>{t('conversations.none')}</Text>}
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
    empty: {
        textAlign: 'center',
        marginTop: space.xl,
        paddingHorizontal: space.xl,
    },
});

export default Conversations;
