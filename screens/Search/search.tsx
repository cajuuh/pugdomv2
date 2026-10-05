import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PugMark, SegmentOption, SegmentedPill } from '../../components/ui';
import { AccountRow } from '../../components/AccountRow/accountRow';
import { HashtagRow } from '../../components/HashtagRow/hashtagRow';
import { NewsCard } from '../../components/NewsCard/newsCard';
import { TootCard } from '../../components/TootCard/tootCard';
import { useAuth } from '../../services/authContext';
import { useTheme } from '../../services/themeContext';
import { useThemedStyles } from '../../services/theme/useThemedStyles';
import { useI18n } from '../../services/i18n/i18nContext';
import { useDebounced, useSearchAll, useSearchPage } from '../../hooks/useSearch';
import {
    useRecentSearches,
    useSuggestions,
    useTrendingLinks,
    useTrendingStatuses,
    useTrendingTags,
} from '../../hooks/useExplore';
import { useRelationships } from '../../hooks/useRelationships';
import { useOpenAccount } from '../../hooks/useOpenAccount';
import { SearchType, shouldResolve } from '../../services/mastodon/search';
import { TrendLink } from '../../services/mastodon/trends';
import { Account, Status } from '../../services/mastodon/types';
import { Tag } from '../../services/mastodon/tags';
import { makeStyles } from './styles';

type Tab = 'all' | SearchType;
const TABS: Tab[] = ['all', 'accounts', 'hashtags', 'statuses'];
const TAB_LABEL = {
    all: 'search.all',
    accounts: 'search.people',
    hashtags: 'search.hashtags',
    statuses: 'search.posts',
} as const;

type ExploreTab = 'posts' | 'hashtags' | 'news' | 'people';
const EXPLORE_TABS: ExploreTab[] = ['posts', 'hashtags', 'news', 'people'];
const EXPLORE_TAB_LABEL = {
    posts: 'explore.posts',
    hashtags: 'explore.hashtags',
    news: 'explore.news',
    people: 'explore.people',
} as const;

const isUrl = (q: string) => /^https?:\/\//i.test(q);

interface SearchProps {
    onStatusPress?: (id: string) => void;
}

export default function Search({ onStatusPress }: SearchProps) {
    const { colors, type, coat } = useTheme();
    const { t } = useI18n();
    const styles = useThemedStyles(makeStyles);
    const { user } = useAuth();
    const { openAccount, openLinkTimeline } = useOpenAccount();
    const [query, setQuery] = useState('');
    const [tab, setTab] = useState<Tab>('all');
    const [exploreTab, setExploreTab] = useState<ExploreTab>('posts');
    const [isExploreRefreshing, setIsExploreRefreshing] = useState(false);

    // Pressing search on the keyboard also looks the query up on other servers
    const [submitted, setSubmitted] = useState('');
    const q = useDebounced(query.trim());
    const resolve = q.length > 0 && (shouldResolve(q) || submitted === q);
    const tabs: SegmentOption<Tab>[] = TABS.map(value => ({ value, label: t(TAB_LABEL[value]) }));
    const exploreTabs: SegmentOption<ExploreTab>[] = EXPLORE_TABS.map(value => ({
        value,
        label: t(EXPLORE_TAB_LABEL[value]),
    }));

    const {
        searches: recentList,
        add: addRecent,
        remove: removeRecent,
        clear: clearRecent,
    } = useRecentSearches(user?.id);

    // Search results (when q is not empty)
    const all = useSearchAll(q, resolve);
    const people = useSearchPage('accounts', q, tab === 'accounts');
    const hashtags = useSearchPage('hashtags', q, tab === 'hashtags');
    const posts = useSearchPage('statuses', q, tab === 'statuses');

    const searchAccounts = useMemo(
        () => (tab === 'accounts' ? people.data?.pages.flat() ?? [] : all.data?.accounts ?? []),
        [tab, people.data, all.data]
    );
    const relationships = useRelationships(
        searchAccounts.map(account => account.id).filter(id => id !== user?.id)
    );

    // Explore results (when q is empty)
    const trendingStatuses = useTrendingStatuses(!q && exploreTab === 'posts');
    const trendingTags = useTrendingTags(!q && exploreTab === 'hashtags');
    const trendingLinks = useTrendingLinks(!q && exploreTab === 'news');
    const suggestions = useSuggestions(!q && exploreTab === 'people');

    const suggestionAccounts = suggestions.data ?? [];
    const suggestionAccountIds = useMemo(
        () =>
            !q && exploreTab === 'people'
                ? suggestionAccounts.map(account => account.id).filter(id => id !== user?.id)
                : [],
        [q, exploreTab, suggestionAccounts, user?.id]
    );
    const suggestionRelationships = useRelationships(suggestionAccountIds);

    // A pasted link to a post or profile opens it directly, once
    const openedFor = useRef('');
    useEffect(() => {
        if (!all.data || !isUrl(q) || openedFor.current === q) return;
        const [status] = all.data.statuses;
        const [account] = all.data.accounts;
        if (status) {
            openedFor.current = q;
            onStatusPress?.(status.id);
        } else if (account) {
            openedFor.current = q;
            openAccount(account);
        }
    }, [all.data, q, onStatusPress, openAccount]);

    const handleSubmit = (text: string) => {
        const trimmed = text.trim();
        setSubmitted(trimmed);
        if (trimmed) {
            addRecent(trimmed);
        }
    };

    const handleSelectRecent = (term: string) => {
        setQuery(term);
        setSubmitted(term);
        addRecent(term);
    };

    const handleExploreRefresh = useCallback(async () => {
        setIsExploreRefreshing(true);
        try {
            if (exploreTab === 'posts') await trendingStatuses.refetch();
            else if (exploreTab === 'hashtags') await trendingTags.refetch();
            else if (exploreTab === 'news') await trendingLinks.refetch();
            else if (exploreTab === 'people') await suggestions.refetch();
        } finally {
            setIsExploreRefreshing(false);
        }
    }, [exploreTab, trendingStatuses, trendingTags, trendingLinks, suggestions]);

    const field = (
        <View style={styles.field}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={() => handleSubmit(query)}
                placeholder={t('search.placeholder')}
                placeholderTextColor={colors.textMuted}
                accessibilityLabel={t('search.placeholder')}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
                style={[type.body, styles.input]}
            />
            {query.length > 0 && (
                <Pressable
                    onPress={() => setQuery('')}
                    accessibilityRole="button"
                    accessibilityLabel={t('search.clear')}
                    hitSlop={10}
                >
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </Pressable>
            )}
        </View>
    );

    const loading = (busy: boolean) =>
        busy ? (
            <View style={styles.status}>
                <ActivityIndicator color={colors.accentColor} />
                {resolve && <Text style={[type.meta, styles.statusText]}>{t('search.looking')}</Text>}
            </View>
        ) : null;

    const message = (text: string) => (
        <View style={styles.status}>
            <Text style={[type.body, styles.statusText]}>{text}</Text>
        </View>
    );

    const postsNote = (
        <View style={styles.note}>
            <Text style={[type.meta, styles.noteText]}>{t('search.postsNote')}</Text>
        </View>
    );

    const renderEmptyExplore = (text: string) => (
        <View style={styles.emptyExplore}>
            <PugMark coat={coat} size={56} />
            <Text style={[type.body, styles.emptyExploreText]}>{text}</Text>
        </View>
    );

    const accountRow = (account: Account) => (
        <AccountRow
            key={account.id}
            account={account}
            relationship={relationships.get(account.id)}
            isSelf={account.id === user?.id}
        />
    );

    const statusRow = (status: Status) => (
        <TootCard key={status.id} status={status} onPress={onStatusPress} />
    );

    const section = (title: string, target: Tab, content: React.ReactNode) => (
        <View key={target}>
            <View style={styles.sectionHeader}>
                <Text accessibilityRole="header" style={[type.label, styles.sectionTitle]}>
                    {title}
                </Text>
                <Pressable
                    onPress={() => setTab(target)}
                    accessibilityRole="button"
                    accessibilityLabel={t('search.seeAllOf', { section: title })}
                    hitSlop={10}
                >
                    <Text style={[type.name, styles.seeAll]}>{t('search.seeAll')}</Text>
                </Pressable>
            </View>
            {content}
        </View>
    );

    const renderAll = () => {
        if (all.isLoading) return loading(true);
        if (all.isError) return message(t('search.failed'));
        const results = all.data;
        if (!results || (!results.accounts.length && !results.hashtags.length && !results.statuses.length)) {
            return (
                <>
                    {message(t('search.nothing', { q }))}
                    {postsNote}
                </>
            );
        }
        return (
            <ScrollView
                style={styles.list}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
            >
                {results.accounts.length > 0 &&
                    section(t('search.people'), 'accounts', results.accounts.map(accountRow))}
                {results.hashtags.length > 0 &&
                    section(
                        t('search.hashtags'),
                        'hashtags',
                        results.hashtags.map(tag => <HashtagRow key={tag.name} tag={tag} />)
                    )}
                {results.statuses.length > 0 &&
                    section(t('search.posts'), 'statuses', results.statuses.map(statusRow))}
            </ScrollView>
        );
    };

    // One kind of search result, paged
    const renderPage = <T,>(
        page: {
            data?: { pages: T[][] };
            isLoading: boolean;
            isError: boolean;
            isFetchingNextPage: boolean;
            hasNextPage: boolean;
            fetchNextPage: () => unknown;
        },
        renderItem: (item: T) => React.ReactElement,
        keyOf: (item: T) => string,
        empty: React.ReactNode
    ) => (
        <FlashList
            data={page.data?.pages.flat() ?? []}
            keyExtractor={keyOf}
            renderItem={({ item }) => renderItem(item)}
            ListEmptyComponent={page.isLoading ? loading(true) : page.isError ? message(t('search.failed')) : <>{empty}</>}
            ListFooterComponent={
                page.isFetchingNextPage ? (
                    <ActivityIndicator style={styles.footer} color={colors.accentColor} />
                ) : null
            }
            onEndReached={() => {
                if (page.hasNextPage && !page.isFetchingNextPage) page.fetchNextPage();
            }}
            onEndReachedThreshold={0.5}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={styles.listContent}
        />
    );

    // Recent searches strip
    const renderRecentSearches = () => {
        if (recentList.length === 0) return null;
        return (
            <View>
                <View style={styles.recentHeader}>
                    <Text style={[type.label, styles.recentTitle]}>{t('search.recent')}</Text>
                    <Pressable
                        onPress={clearRecent}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={t('search.clearRecent')}
                    >
                        <Text style={[type.name, styles.clearRecent]}>{t('search.clearRecent')}</Text>
                    </Pressable>
                </View>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    style={styles.recentRow}
                    contentContainerStyle={styles.recentList}
                >
                    {recentList.map(term => (
                        <Pressable
                            key={term}
                            style={styles.recentChip}
                            onPress={() => handleSelectRecent(term)}
                            accessibilityRole="button"
                            accessibilityLabel={term}
                        >
                            <Ionicons name="time-outline" size={13} color={colors.textMuted} />
                            <Text style={[type.name, styles.recentText]} numberOfLines={1}>
                                {term}
                            </Text>
                            <Pressable
                                style={styles.recentRemove}
                                onPress={() => removeRecent(term)}
                                hitSlop={8}
                                accessibilityRole="button"
                                accessibilityLabel={t('search.removeRecent', { term })}
                            >
                                <Ionicons name="close" size={13} color={colors.textMuted} />
                            </Pressable>
                        </Pressable>
                    ))}
                </ScrollView>
            </View>
        );
    };

    // When search query is empty, show Explore
    if (!q) {
        return (
            <View style={styles.container}>
                {field}
                {renderRecentSearches()}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    style={styles.tabsRow}
                    contentContainerStyle={styles.tabs}
                >
                    <SegmentedPill
                        variant="chips"
                        options={exploreTabs}
                        value={exploreTab}
                        onChange={setExploreTab}
                    />
                </ScrollView>
                <View style={styles.exploreContainer}>
                    {exploreTab === 'posts' && (
                        <FlashList
                            data={trendingStatuses.data?.pages.flat() ?? []}
                            keyExtractor={(item: Status) => item.id}
                            renderItem={({ item }) => <TootCard status={item} onPress={onStatusPress} />}
                            ListEmptyComponent={
                                trendingStatuses.isLoading
                                    ? loading(true)
                                    : renderEmptyExplore(t('explore.emptyPosts'))
                            }
                            ListFooterComponent={
                                trendingStatuses.isFetchingNextPage ? (
                                    <ActivityIndicator style={styles.footer} color={colors.accentColor} />
                                ) : null
                            }
                            onEndReached={() => {
                                if (trendingStatuses.hasNextPage && !trendingStatuses.isFetchingNextPage) {
                                    trendingStatuses.fetchNextPage();
                                }
                            }}
                            onEndReachedThreshold={0.5}
                            refreshControl={
                                <RefreshControl
                                    refreshing={isExploreRefreshing}
                                    onRefresh={handleExploreRefresh}
                                    tintColor={colors.accentColor}
                                    colors={[colors.accentColor]}
                                />
                            }
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode="on-drag"
                            contentContainerStyle={styles.listContent}
                        />
                    )}

                    {exploreTab === 'hashtags' && (
                        <FlashList
                            data={trendingTags.data?.pages.flat() ?? []}
                            keyExtractor={(item: Tag) => item.name}
                            renderItem={({ item }) => <HashtagRow tag={item} />}
                            ListEmptyComponent={
                                trendingTags.isLoading
                                    ? loading(true)
                                    : renderEmptyExplore(t('explore.emptyHashtags'))
                            }
                            ListFooterComponent={
                                trendingTags.isFetchingNextPage ? (
                                    <ActivityIndicator style={styles.footer} color={colors.accentColor} />
                                ) : null
                            }
                            onEndReached={() => {
                                if (trendingTags.hasNextPage && !trendingTags.isFetchingNextPage) {
                                    trendingTags.fetchNextPage();
                                }
                            }}
                            onEndReachedThreshold={0.5}
                            refreshControl={
                                <RefreshControl
                                    refreshing={isExploreRefreshing}
                                    onRefresh={handleExploreRefresh}
                                    tintColor={colors.accentColor}
                                    colors={[colors.accentColor]}
                                />
                            }
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode="on-drag"
                            contentContainerStyle={styles.listContent}
                        />
                    )}

                    {exploreTab === 'news' && (
                        <FlashList
                            data={trendingLinks.data?.pages.flat() ?? []}
                            keyExtractor={(item: TrendLink) => item.url}
                            renderItem={({ item }) => (
                                <NewsCard link={item} onPressLinkTimeline={openLinkTimeline} />
                            )}
                            ListEmptyComponent={
                                trendingLinks.isLoading
                                    ? loading(true)
                                    : renderEmptyExplore(t('explore.emptyNews'))
                            }
                            ListFooterComponent={
                                trendingLinks.isFetchingNextPage ? (
                                    <ActivityIndicator style={styles.footer} color={colors.accentColor} />
                                ) : null
                            }
                            onEndReached={() => {
                                if (trendingLinks.hasNextPage && !trendingLinks.isFetchingNextPage) {
                                    trendingLinks.fetchNextPage();
                                }
                            }}
                            onEndReachedThreshold={0.5}
                            refreshControl={
                                <RefreshControl
                                    refreshing={isExploreRefreshing}
                                    onRefresh={handleExploreRefresh}
                                    tintColor={colors.accentColor}
                                    colors={[colors.accentColor]}
                                />
                            }
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode="on-drag"
                            contentContainerStyle={styles.listContent}
                        />
                    )}

                    {exploreTab === 'people' && (
                        <FlashList
                            data={suggestionAccounts}
                            keyExtractor={(item: Account) => item.id}
                            renderItem={({ item }) => (
                                <AccountRow
                                    account={item}
                                    relationship={suggestionRelationships.get(item.id)}
                                    isSelf={item.id === user?.id}
                                />
                            )}
                            ListEmptyComponent={
                                suggestions.isLoading
                                    ? loading(true)
                                    : renderEmptyExplore(t('explore.emptyPeople'))
                            }
                            refreshControl={
                                <RefreshControl
                                    refreshing={isExploreRefreshing}
                                    onRefresh={handleExploreRefresh}
                                    tintColor={colors.accentColor}
                                    colors={[colors.accentColor]}
                                />
                            }
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode="on-drag"
                            contentContainerStyle={styles.listContent}
                        />
                    )}
                </View>
            </View>
        );
    }

    // When search query is entered, show Search Results
    return (
        <View style={styles.container}>
            {field}
            {/* One row; it scrolls sideways if the labels don't fit */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                style={styles.tabsRow}
                contentContainerStyle={styles.tabs}
            >
                <SegmentedPill variant="chips" options={tabs} value={tab} onChange={setTab} />
            </ScrollView>
            <View style={styles.list}>
                {tab === 'all' && renderAll()}
                {tab === 'accounts' &&
                    renderPage<Account>(
                        people,
                        accountRow,
                        account => account.id,
                        message(t('search.noPeople'))
                    )}
                {tab === 'hashtags' &&
                    renderPage<Tag>(
                        hashtags,
                        tag => <HashtagRow tag={tag} />,
                        tag => tag.name,
                        message(t('search.noHashtags'))
                    )}
                {tab === 'statuses' &&
                    renderPage<Status>(
                        posts,
                        statusRow,
                        status => status.id,
                        <>
                            {message(t('search.nothing', { q }))}
                            {postsNote}
                        </>
                    )}
            </View>
        </View>
    );
}
