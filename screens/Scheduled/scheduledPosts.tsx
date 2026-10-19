import React, { useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import Ionicons from '@expo/vector-icons/Ionicons';
import { InfiniteData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../services/themeContext';
import { useI18n } from '../../services/i18n/i18nContext';
import { useOptionalAuth } from '../../services/authContext';
import {
    ScheduledStatus,
    ScheduledStatusesPage,
    cancelScheduledStatus,
    getScheduledStatuses,
    rescheduleStatus,
} from '../../services/mastodon/scheduledStatuses';
import { radii, space } from '../../services/theme/shape';
import { TAB_BAR_CLEARANCE } from '../../components/TabBar/styles';
import { Card, IconButton, PillButton } from '../../components/ui';
import { ScheduleSheet, formatScheduleTime } from '../../components/ComposeModal/scheduleSheet';
import { dialog } from '../../services/dialog';

interface ScheduledPostsProps {
    onBack: () => void;
}

export const scheduledPostsKey = (accountId: string) => ['scheduledStatuses', accountId];

// Posts waiting to go out, soonest first: change when, or cancel
const ScheduledPosts = ({ onBack }: ScheduledPostsProps) => {
    const { colors, type } = useTheme();
    const i18n = useI18n();
    const { t, tn, locale } = i18n;
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();
    const me = useOptionalAuth()?.user;
    const key = scheduledPostsKey(me?.id ?? '');
    const [moving, setMoving] = useState<ScheduledStatus | null>(null);

    const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage, refetch, isRefetching } = useInfiniteQuery({
        queryKey: key,
        queryFn: ({ pageParam }) => getScheduledStatuses(pageParam),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (page: ScheduledStatusesPage) => page.nextMaxId,
    });
    const scheduled = (data?.pages.flatMap(page => page.statuses) ?? []).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));

    const replace = (change: (list: ScheduledStatus[]) => ScheduledStatus[]) =>
        queryClient.setQueryData<InfiniteData<ScheduledStatusesPage>>(key, current =>
            current && { ...current, pages: current.pages.map(page => ({ ...page, statuses: change(page.statuses) })) }
        );

    const move = async (item: ScheduledStatus, at: Date) => {
        try {
            const updated = await rescheduleStatus(item.id, at);
            replace(list => list.map(entry => (entry.id === item.id ? updated : entry)));
        } catch (error: any) {
            console.warn('Rescheduling failed:', error);
            dialog.alert(t('scheduled.moveFailed'), error?.response?.data?.error || t('scheduled.tryAgain'));
        }
    };

    const cancel = (item: ScheduledStatus) =>
        dialog.alert(t('scheduled.cancelTitle'), t('scheduled.cancelMessage'), [
            { text: t('scheduled.keep'), style: 'cancel' },
            {
                text: t('scheduled.cancel'),
                style: 'destructive',
                onPress: async () => {
                    try {
                        await cancelScheduledStatus(item.id);
                        replace(list => list.filter(entry => entry.id !== item.id));
                    } catch (error) {
                        console.warn('Cancelling the scheduled post failed:', error);
                        dialog.toast(t('scheduled.cancelFailed'));
                    }
                },
            },
        ]);

    const renderItem = ({ item }: { item: ScheduledStatus }) => {
        const when = formatScheduleTime(new Date(item.scheduled_at), locale);
        const text = item.params.spoiler_text ? `⚠ ${item.params.spoiler_text}` : item.params.text;
        const media = item.media_attachments.length;
        return (
            <Card style={styles.card}>
                <View style={styles.when}>
                    <Ionicons name="calendar" size={16} color={colors.accentText} />
                    <Text style={[type.name, { color: colors.accentText }]}>{when}</Text>
                </View>
                {!!text && (
                    <Text style={[type.body, { color: colors.textPrimary }]} numberOfLines={4}>
                        {text}
                    </Text>
                )}
                {(media > 0 || !!item.params.poll) && (
                    <Text style={[type.meta, { color: colors.textMuted }]}>
                        {[media > 0 ? tn('scheduled.attachments', media) : null, item.params.poll ? t('scheduled.poll') : null].filter(Boolean).join(' · ')}
                    </Text>
                )}
                <View style={styles.actions}>
                    <PillButton label={t('scheduled.changeTime')} icon="time-outline" variant="ghost" size="small" onPress={() => setMoving(item)} />
                    <PillButton label={t('scheduled.cancel')} icon="trash-outline" variant="ghost" size="small" onPress={() => cancel(item)} />
                </View>
            </Card>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.borderColor, backgroundColor: colors.cardBackground }]}>
                <IconButton icon="arrow-back" accessibilityLabel={t('common.goBack')} onPress={onBack} />
                <Text accessibilityRole="header" style={[type.name, styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                    {t('scheduled.title')}
                </Text>
                <View style={styles.spacer} />
            </View>
            {isLoading ? (
                <ActivityIndicator style={styles.loading} color={colors.accentColor} />
            ) : (
                <FlashList
                    data={scheduled}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
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
                    ListEmptyComponent={<Text style={[type.body, styles.empty, { color: colors.textMuted }]}>{t('scheduled.empty')}</Text>}
                    ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={colors.accentColor} /> : null}
                />
            )}
            <ScheduleSheet
                visible={!!moving}
                value={moving ? new Date(moving.scheduled_at) : null}
                onSchedule={at => moving && move(moving, at)}
                onClose={() => setMoving(null)}
            />
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
        paddingTop: space.md,
        paddingHorizontal: space.lg,
        paddingBottom: TAB_BAR_CLEARANCE,
    },
    card: {
        padding: space.md,
        marginBottom: space.md,
        gap: space.sm,
        borderRadius: radii.card,
    },
    when: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
    },
    actions: {
        flexDirection: 'row',
        gap: space.sm,
    },
    empty: {
        textAlign: 'center',
        marginTop: space.xl,
        paddingHorizontal: space.xl,
    },
});

export default ScheduledPosts;
