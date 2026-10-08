import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTheme } from '../../services/themeContext';
import { useI18n } from '../../services/i18n/i18nContext';
import { useOptionalAuth } from '../../services/authContext';
import { getReactions, Reaction, ReactionsPage } from '../../services/mastodon/statuses';
import { useRelationships } from '../../hooks/useRelationships';
import { space } from '../../services/theme/shape';
import { TAB_BAR_CLEARANCE } from '../../components/TabBar/styles';
import { AccountRow } from '../../components/AccountRow/accountRow';
import { IconButton } from '../../components/ui';

interface ReactionsProps {
    statusId: string;
    reaction: Reaction;
    onBack: () => void;
}

// The people who favourited or boosted a post, each with a follow button
const Reactions = ({ statusId, reaction, onBack }: ReactionsProps) => {
    const { colors, type } = useTheme();
    const { t } = useI18n();
    const insets = useSafeAreaInsets();
    const me = useOptionalAuth()?.user;

    const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
        queryKey: ['reactions', statusId, reaction],
        queryFn: ({ pageParam }) => getReactions(statusId, reaction, pageParam),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (page: ReactionsPage) => page.nextMaxId,
    });
    const accounts = data?.pages.flatMap(page => page.accounts) ?? [];
    const relationships = useRelationships(accounts.filter(account => account.id !== me?.id).map(account => account.id));

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.borderColor, backgroundColor: colors.cardBackground }]}>
                <IconButton icon="arrow-back" accessibilityLabel={t('common.goBack')} onPress={onBack} />
                <Text accessibilityRole="header" style={[type.name, styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                    {t(reaction === 'favourites' ? 'reactions.favouritesTitle' : 'reactions.boostsTitle')}
                </Text>
                <View style={styles.spacer} />
            </View>

            {isLoading ? (
                <ActivityIndicator style={styles.loading} color={colors.accentColor} />
            ) : (
                <FlashList
                    data={accounts}
                    extraData={relationships}
                    keyExtractor={account => account.id}
                    renderItem={({ item }) => <AccountRow account={item} relationship={relationships.get(item.id)} isSelf={item.id === me?.id} />}
                    contentContainerStyle={styles.list}
                    onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
                    onEndReachedThreshold={0.5}
                    ListEmptyComponent={<Text style={[type.body, styles.empty, { color: colors.textMuted }]}>{t('reactions.none')}</Text>}
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
        paddingTop: space.sm,
        paddingBottom: TAB_BAR_CLEARANCE,
    },
    empty: {
        textAlign: 'center',
        marginTop: space.xl,
        paddingHorizontal: space.xl,
    },
});

export default Reactions;
