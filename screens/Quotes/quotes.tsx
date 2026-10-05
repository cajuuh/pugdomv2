import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { InfiniteData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../services/themeContext';
import { useI18n } from '../../services/i18n/i18nContext';
import { useOptionalAuth } from '../../services/authContext';
import { getQuotes, QuotesPage, revokeQuote } from '../../services/mastodon/quotes';
import { Status } from '../../services/mastodon/types';
import { space } from '../../services/theme/shape';
import { TAB_BAR_CLEARANCE } from '../../components/TabBar/styles';
import { TootCard } from '../../components/TootCard/tootCard';
import { IconButton, PillButton } from '../../components/ui';
import { dialog } from '../../services/dialog';

interface QuotesProps {
    // The post whose quotes these are
    status: Status;
    onBack: () => void;
    onStatusPress: (id: string) => void;
}

// Under ['timeline'], so likes, boosts and edits stay in sync with the rest of the app
export const quotesKey = (statusId: string) => ['timeline', 'quotes', statusId];

// The posts quoting a post. On your own posts, each quote can be removed (revoked).
const Quotes = ({ status, onBack, onStatusPress }: QuotesProps) => {
    const { colors, type } = useTheme();
    const { t } = useI18n();
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();
    const auth = useOptionalAuth();
    const yours = !!auth?.user && auth.user.id === status.account.id;

    const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
        queryKey: quotesKey(status.id),
        queryFn: ({ pageParam }) => getQuotes(status.id, pageParam),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (page: QuotesPage) => page.nextMaxId,
    });
    const quotes = data?.pages.flatMap(page => page.statuses) ?? [];

    const revoke = (quoting: Status) =>
        dialog.alert(t('quotes.revokeTitle'), t('quotes.revokeMessage', { acct: quoting.account.acct }), [
            { text: t('common.cancel'), style: 'cancel' },
            {
                text: t('quotes.revoke'),
                style: 'destructive',
                onPress: async () => {
                    try {
                        await revokeQuote(status.id, quoting.id);
                        queryClient.setQueryData<InfiniteData<QuotesPage>>(quotesKey(status.id), current =>
                            current && { ...current, pages: current.pages.map(page => ({ ...page, statuses: page.statuses.filter(item => item.id !== quoting.id) })) }
                        );
                    } catch (error) {
                        console.warn('Revoking the quote failed:', error);
                        dialog.toast(t('quotes.revokeFailed'));
                    }
                },
            },
        ]);

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.borderColor, backgroundColor: colors.cardBackground }]}>
                <IconButton icon="arrow-back" accessibilityLabel={t('common.goBack')} onPress={onBack} />
                <Text accessibilityRole="header" style={[type.name, styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                    {t('quotes.listTitle')}
                </Text>
                <View style={styles.spacer} />
            </View>

            {isLoading ? (
                <ActivityIndicator style={styles.loading} color={colors.accentColor} />
            ) : (
                <FlashList
                    data={quotes}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.list}
                    onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
                    onEndReachedThreshold={0.5}
                    ListEmptyComponent={<Text style={[type.body, styles.empty, { color: colors.textMuted }]}>{t('quotes.none')}</Text>}
                    ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={colors.accentColor} /> : null}
                    renderItem={({ item }) => (
                        <View style={styles.row}>
                            <TootCard status={item} onPress={onStatusPress} />
                            {yours && (
                                <PillButton
                                    label={t('quotes.revoke')}
                                    icon="remove-circle-outline"
                                    size="small"
                                    variant="subtle"
                                    onPress={() => revoke(item)}
                                    style={styles.revoke}
                                />
                            )}
                        </View>
                    )}
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
        gap: space.xs,
        paddingBottom: space.sm,
    },
    revoke: {
        alignSelf: 'flex-end',
        marginHorizontal: space.lg,
    },
    empty: {
        textAlign: 'center',
        marginTop: space.xl,
        marginHorizontal: space.lg,
    },
});

export default Quotes;
