import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PugMark, SegmentOption, SegmentedPill } from '../../components/ui';
import { AccountRow } from '../../components/AccountRow/accountRow';
import { HashtagRow } from '../../components/HashtagRow/hashtagRow';
import { TootCard } from '../../components/TootCard/tootCard';
import { useAuth } from '../../services/authContext';
import { useTheme } from '../../services/themeContext';
import { useThemedStyles } from '../../services/theme/useThemedStyles';
import { useI18n } from '../../services/i18n/i18nContext';
import { useDebounced, useSearchAll, useSearchPage } from '../../hooks/useSearch';
import { useRelationships } from '../../hooks/useRelationships';
import { useOpenAccount } from '../../hooks/useOpenAccount';
import { SearchType, shouldResolve } from '../../services/mastodon/search';
import { Account, Status } from '../../services/mastodon/types';
import { Tag } from '../../services/mastodon/tags';
import { makeStyles } from './styles';

type Tab = 'all' | SearchType;
const TABS: Tab[] = ['all', 'accounts', 'hashtags', 'statuses'];
const TAB_LABEL = { all: 'search.all', accounts: 'search.people', hashtags: 'search.hashtags', statuses: 'search.posts' } as const;

const isUrl = (q: string) => /^https?:\/\//i.test(q);

interface SearchProps {
    onStatusPress?: (id: string) => void;
}

export default function Search({ onStatusPress }: SearchProps) {
    const { colors, type, coat } = useTheme();
    const { t } = useI18n();
    const styles = useThemedStyles(makeStyles);
    const { user } = useAuth();
    const { openAccount } = useOpenAccount();
    const [query, setQuery] = useState('');
    const [tab, setTab] = useState<Tab>('all');
    // Pressing search on the keyboard also looks the query up on other servers
    const [submitted, setSubmitted] = useState('');
    const q = useDebounced(query.trim());
    const resolve = q.length > 0 && (shouldResolve(q) || submitted === q);
    const tabs: SegmentOption<Tab>[] = TABS.map(value => ({ value, label: t(TAB_LABEL[value]) }));

    const all = useSearchAll(q, resolve);
    const people = useSearchPage('accounts', q, tab === 'accounts');
    const hashtags = useSearchPage('hashtags', q, tab === 'hashtags');
    const posts = useSearchPage('statuses', q, tab === 'statuses');

    const accounts = useMemo(
        () => (tab === 'accounts' ? people.data?.pages.flat() ?? [] : all.data?.accounts ?? []),
        [tab, people.data, all.data]
    );
    const relationships = useRelationships(accounts.map(account => account.id).filter(id => id !== user?.id));

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

    const field = (
        <View style={styles.field}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={() => setSubmitted(query.trim())}
                placeholder={t('search.placeholder')}
                placeholderTextColor={colors.textMuted}
                accessibilityLabel={t('search.placeholder')}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
                style={[type.body, styles.input]}
            />
            {query.length > 0 && (
                <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel={t('search.clear')} hitSlop={10}>
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </Pressable>
            )}
        </View>
    );

    if (!q) {
        return (
            <View style={styles.container}>
                {field}
                <View style={styles.start}>
                    <PugMark coat={coat} size={72} />
                    <Text style={[type.name, styles.startText]}>{t('search.start')}</Text>
                    <Text style={[type.meta, styles.hint]}>{t('search.startHint')}</Text>
                </View>
            </View>
        );
    }

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
    const accountRow = (account: Account) => (
        <AccountRow key={account.id} account={account} relationship={relationships.get(account.id)} isSelf={account.id === user?.id} />
    );
    const statusRow = (status: Status) => <TootCard key={status.id} status={status} onPress={onStatusPress} />;
    const section = (title: string, target: Tab, content: React.ReactNode) => (
        <View key={target}>
            <View style={styles.sectionHeader}>
                <Text accessibilityRole="header" style={[type.label, styles.sectionTitle]}>{title}</Text>
                <Pressable onPress={() => setTab(target)} accessibilityRole="button" accessibilityLabel={t('search.seeAllOf', { section: title })} hitSlop={10}>
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
                {results.accounts.length > 0 && section(t('search.people'), 'accounts', results.accounts.map(accountRow))}
                {results.hashtags.length > 0 && section(t('search.hashtags'), 'hashtags', results.hashtags.map(tag => <HashtagRow key={tag.name} tag={tag} />))}
                {results.statuses.length > 0 && section(t('search.posts'), 'statuses', results.statuses.map(statusRow))}
            </ScrollView>
        );
    };

    // One kind of result, paged
    const renderPage = <T,>(
        page: { data?: { pages: T[][] }; isLoading: boolean; isError: boolean; isFetchingNextPage: boolean; hasNextPage: boolean; fetchNextPage: () => unknown },
        renderItem: (item: T) => React.ReactElement,
        keyOf: (item: T) => string,
        empty: React.ReactNode
    ) => (
        <FlashList
            data={page.data?.pages.flat() ?? []}
            keyExtractor={keyOf}
            renderItem={({ item }) => renderItem(item)}
            ListEmptyComponent={page.isLoading ? loading(true) : page.isError ? message(t('search.failed')) : <>{empty}</>}
            ListFooterComponent={page.isFetchingNextPage ? <ActivityIndicator style={styles.footer} color={colors.accentColor} /> : null}
            onEndReached={() => {
                if (page.hasNextPage && !page.isFetchingNextPage) page.fetchNextPage();
            }}
            onEndReachedThreshold={0.5}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={styles.listContent}
        />
    );

    return (
        <View style={styles.container}>
            {field}
            {/* One row; it scrolls sideways if the labels don't fit */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={styles.tabsRow} contentContainerStyle={styles.tabs}>
                <SegmentedPill variant="chips" options={tabs} value={tab} onChange={setTab} />
            </ScrollView>
            <View style={styles.list}>
                {tab === 'all' && renderAll()}
                {tab === 'accounts' && renderPage<Account>(people, accountRow, account => account.id, message(t('search.noPeople')))}
                {tab === 'hashtags' && renderPage<Tag>(hashtags, tag => <HashtagRow tag={tag} />, tag => tag.name, message(t('search.noHashtags')))}
                {tab === 'statuses' && renderPage<Status>(posts, statusRow, status => status.id, (
                    <>
                        {message(t('search.nothing', { q }))}
                        {postsNote}
                    </>
                ))}
            </View>
        </View>
    );
}
