import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTheme } from '../../services/themeContext';
import { useI18n } from '../../services/i18n/i18nContext';
import { getModeratedAccounts, ModeratedList } from '../../services/mastodon/accounts';
import { ReactionsPage } from '../../services/mastodon/statuses';
import { useModeration } from '../../hooks/useModeration';
import { space } from '../../services/theme/shape';
import { TAB_BAR_CLEARANCE } from '../../components/TabBar/styles';
import { AccountRow } from '../../components/AccountRow/accountRow';
import { formatScheduleTime } from '../../components/ComposeModal/scheduleSheet';
import { IconButton, PillButton, SegmentedPill } from '../../components/ui';

// The people you muted or blocked (tester request), each with a button to undo it. Undoing reloads the
// list (useModerationChange), so they drop out of it.
const ModeratedAccounts = ({ onBack }: { onBack: () => void }) => {
    const { colors, type } = useTheme();
    const { t, locale } = useI18n();
    const insets = useSafeAreaInsets();
    const { unmute, unblock } = useModeration();
    const [list, setList] = useState<ModeratedList>('mutes');

    const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
        queryKey: ['moderatedAccounts', list],
        queryFn: ({ pageParam }) => getModeratedAccounts(list, pageParam),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (page: ReactionsPage) => page.nextMaxId,
    });
    const accounts = data?.pages.flatMap(page => page.accounts) ?? [];
    const muted = list === 'mutes';

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.borderColor, backgroundColor: colors.cardBackground }]}>
                <IconButton icon="arrow-back" accessibilityLabel={t('common.goBack')} onPress={onBack} />
                <Text accessibilityRole="header" style={[type.name, styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                    {t('moderated.title')}
                </Text>
                <View style={styles.spacer} />
            </View>
            <View style={styles.tabs}>
                <SegmentedPill
                    options={[{ value: 'mutes', label: t('moderated.muted') }, { value: 'blocks', label: t('moderated.blocked') }]}
                    value={list}
                    onChange={setList}
                />
            </View>

            {isLoading ? (
                <ActivityIndicator style={styles.loading} color={colors.accentColor} />
            ) : (
                <FlashList
                    data={accounts}
                    keyExtractor={account => account.id}
                    renderItem={({ item }) => {
                        const name = item.display_name || item.username;
                        return (
                            <AccountRow
                                account={item}
                                detail={muted && item.mute_expires_at ? t('moderated.mutedUntil', { when: formatScheduleTime(new Date(item.mute_expires_at), locale) }) : undefined}
                                action={
                                    <PillButton
                                        label={t(muted ? 'moderated.unmute' : 'moderated.unblock')}
                                        accessibilityLabel={t(muted ? 'moderated.unmuteLabel' : 'moderated.unblockLabel', { name })}
                                        variant="secondary"
                                        size="small"
                                        onPress={() => (muted ? unmute(item) : unblock(item))}
                                    />
                                }
                            />
                        );
                    }}
                    contentContainerStyle={styles.list}
                    onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
                    onEndReachedThreshold={0.5}
                    ListEmptyComponent={
                        <Text style={[type.body, styles.empty, { color: colors.textMuted }]}>{t(muted ? 'moderated.noneMuted' : 'moderated.noneBlocked')}</Text>
                    }
                    ListFooterComponent={isFetchingNextPage ? <ActivityIndicator style={styles.footer} color={colors.accentColor} /> : null}
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
    tabs: {
        paddingHorizontal: space.lg,
        paddingTop: space.md,
    },
    loading: {
        marginTop: space.xl,
    },
    footer: {
        paddingVertical: space.md,
    },
    list: {
        paddingTop: space.sm,
        paddingBottom: TAB_BAR_CLEARANCE,
    },
    empty: {
        textAlign: 'center',
        marginTop: space.xl,
        paddingHorizontal: space.xl,
    },
});

export default ModeratedAccounts;
