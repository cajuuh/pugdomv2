import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTheme } from '../../services/themeContext';
import { useI18n } from '../../services/i18n/i18nContext';
import { useOptionalAuth } from '../../services/authContext';
import { getReactions, Reaction, ReactionsPage } from '../../services/mastodon/statuses';
import { FollowList, getFollows } from '../../services/mastodon/accounts';
import { TKey } from '../../services/i18n/translate';
import { useRelationships } from '../../hooks/useRelationships';
import { radii, space } from '../../services/theme/shape';
import { Account } from '../../services/mastodon/types';
import { TAB_BAR_CLEARANCE } from '../../components/TabBar/styles';
import { AccountRow } from '../../components/AccountRow/accountRow';
import { IconButton } from '../../components/ui';

// A post's favourites or boosts (id: the post), or an account's followers or following (id: the account)
export type AccountListKind = Reaction | FollowList;

const TITLES: Record<AccountListKind, TKey> = {
    favourites: 'reactions.favouritesTitle',
    boosts: 'reactions.boostsTitle',
    followers: 'reactions.followersTitle',
    following: 'reactions.followingTitle',
};

// Mastodon can't filter these lists, so a search looks through them here, loading the rest of the list first.
// ponytail: stops loading at 50 pages (4,000 people); past that, matches further down aren't found
const MAX_SEARCH_PAGES = 50;

// Case and accents don't matter: "jose" finds José
const fold = (text: string) => text.normalize?.('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() ?? text.toLowerCase();
export const matchesSearch = (account: Pick<Account, 'display_name' | 'username' | 'acct'>, query: string) =>
    fold(`${account.display_name} ${account.username} ${account.acct}`).includes(fold(query.trim()));

interface ReactionsProps {
    id: string;
    kind: AccountListKind;
    onBack: () => void;
}

// A list of people, each with a follow button: who favourited or boosted a post, or someone's followers or following
const Reactions = ({ id, kind, onBack }: ReactionsProps) => {
    const { colors, type } = useTheme();
    const { t } = useI18n();
    const insets = useSafeAreaInsets();
    const me = useOptionalAuth()?.user;

    const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
        queryKey: ['reactions', id, kind],
        queryFn: ({ pageParam }) => kind === 'followers' || kind === 'following' ? getFollows(id, kind, pageParam) : getReactions(id, kind, pageParam),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (page: ReactionsPage) => page.nextMaxId,
    });
    const allAccounts = data?.pages.flatMap(page => page.accounts) ?? [];
    // Followers and following can be searched
    const searchable = kind === 'followers' || kind === 'following';
    const [query, setQuery] = useState('');
    const searching = searchable && query.trim().length > 0;
    const accounts = searching ? allAccounts.filter(account => matchesSearch(account, query)) : allAccounts;
    const pages = data?.pages.length ?? 0;
    const loadingRest = searching && hasNextPage && pages < MAX_SEARCH_PAGES;
    useEffect(() => {
        if (loadingRest && !isFetchingNextPage) fetchNextPage();
    }, [loadingRest, isFetchingNextPage, pages, fetchNextPage]);
    const relationships = useRelationships(accounts.filter(account => account.id !== me?.id).map(account => account.id));

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.borderColor, backgroundColor: colors.cardBackground }]}>
                <IconButton icon="arrow-back" accessibilityLabel={t('common.goBack')} onPress={onBack} />
                <Text accessibilityRole="header" style={[type.name, styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                    {t(TITLES[kind])}
                </Text>
                <View style={styles.spacer} />
            </View>

            {searchable && (
                <View style={[styles.field, { backgroundColor: colors.inputBackground }]}>
                    <Ionicons name="search" size={18} color={colors.textMuted} />
                    <TextInput
                        value={query}
                        onChangeText={setQuery}
                        placeholder={t(kind === 'followers' ? 'reactions.searchFollowers' : 'reactions.searchFollowing')}
                        placeholderTextColor={colors.textMuted}
                        accessibilityLabel={t(kind === 'followers' ? 'reactions.searchFollowers' : 'reactions.searchFollowing')}
                        returnKeyType="search"
                        autoCapitalize="none"
                        autoCorrect={false}
                        style={[type.body, styles.input, { color: colors.textPrimary }]}
                    />
                    {query.length > 0 && (
                        <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel={t('search.clear')} hitSlop={10}>
                            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                        </Pressable>
                    )}
                </View>
            )}

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
                    keyboardShouldPersistTaps="handled"
                    onEndReachedThreshold={0.5}
                    ListEmptyComponent={
                        // While a search is still loading the list, the footer says so instead
                        loadingRest ? null : (
                            <Text style={[type.body, styles.empty, { color: colors.textMuted }]}>
                                {t(searching ? 'reactions.searchNone' : searchable ? 'reactions.followsNone' : 'reactions.none')}
                            </Text>
                        )
                    }
                    ListFooterComponent={
                        isFetchingNextPage || loadingRest ? (
                            <View style={styles.footer}>
                                <ActivityIndicator color={colors.accentColor} />
                                {searching && <Text style={[type.meta, { color: colors.textMuted }]}>{t('reactions.searchLoading', { count: allAccounts.length })}</Text>}
                            </View>
                        ) : null
                    }
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
    field: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        height: 44,
        marginHorizontal: space.lg,
        marginTop: space.md,
        paddingHorizontal: space.md,
        borderRadius: radii.pill,
    },
    input: {
        flex: 1,
        paddingVertical: 0,
    },
    footer: {
        alignItems: 'center',
        gap: space.xs,
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

export default Reactions;
