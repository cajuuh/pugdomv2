import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { ActivityIndicator, RefreshControl, DeviceEventEmitter, Pressable, ScrollView, Text, View } from 'react-native';
import { FlashList, FlashListRef } from '@shopify/flash-list';
import { InfiniteData, useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFeed } from '../../hooks/useFeed';
import { usePinnedFeeds } from '../../hooks/usePinnedFeeds';
import { Status } from '../../services/mastodon/types';
import { DEFAULT_PINNED_FEEDS, FeedDescriptor, feedIcon, feedLabel } from '../../services/mastodon/feedTypes';
import { TootCard } from '../../components/TootCard/tootCard';
import { FeedsSheet } from '../../components/FeedsSheet/feedsSheet';
import { FEED_CREATED_EVENT } from '../FeedEditor/feedEditor';
import { useNavigator } from '../../services/navigationContext';
import { hitSlopFor } from '../../services/theme/shape';
import { useTheme } from '../../services/themeContext';
import { FEED_PILL_HEIGHT, makeStyles } from './styles';
import { useThemedStyles } from '../../services/theme/useThemedStyles';
import { useI18n } from '../../services/i18n/i18nContext';
import { useNewPosts } from '../../hooks/useNewPosts';
import { NewPostsPill } from './newPostsPill';

// FlashList keeps the first visible post in place while posts above it get measured, which cut an
// animated scrollToOffset(0) short after scrolling far. scrollToIndex pauses that correction, jumps
// near the top and animates the rest; then settle on offset 0 (the list's top padding).
export const scrollListToTop = async (list: Pick<FlashListRef<Status>, 'scrollToIndex' | 'scrollToOffset'> | null) => {
    if (!list) return;
    await list.scrollToIndex({ index: 0, animated: true });
    list.scrollToOffset({ offset: 0, animated: true });
};

interface TimelineProps {
    onStatusPress?: (id: string) => void;
}

const Timeline = ({ onStatusPress }: TimelineProps) => {
    const { colors, type } = useTheme();
    const styles = useThemedStyles(makeStyles);
    const i18n = useI18n();
    const { t } = i18n;
    const { push } = useNavigator();
    const { pinnedFeeds } = usePinnedFeeds();

    const [activeFeed, setActiveFeed] = useState<FeedDescriptor>(DEFAULT_PINNED_FEEDS[0]);
    const [feedsSheetOpen, setFeedsSheetOpen] = useState(false);
    const queryClient = useQueryClient();
    const listRef = useRef<FlashListRef<Status>>(null);

    // A hashtag feed made in the editor opens straight away
    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener(FEED_CREATED_EVENT, (feed: FeedDescriptor) => setActiveFeed(feed));
        return () => subscription.remove();
    }, []);

    // If the open feed gets unpinned, go back to the first pinned one (Home)
    useEffect(() => {
        if (!pinnedFeeds.some(f => f.id === activeFeed.id)) {
            setActiveFeed(pinnedFeeds[0] || DEFAULT_PINNED_FEEDS[0]);
        }
    }, [pinnedFeeds, activeFeed.id]);

    const resolveEmptyMessage = useCallback((feed: FeedDescriptor) => {
        if (feed.kind === 'home') return t('timeline.emptyHome');
        if (feed.kind === 'local') return t('timeline.emptyLocal');
        if (feed.kind === 'federated') return t('timeline.emptyFederated');
        if (feed.kind === 'trending') return t('timeline.emptyTrending');
        if (feed.kind === 'hashtag') return t('timeline.emptyHashtag');
        return t('timeline.emptyHome');
    }, [t]);

    const {
        data,
        isLoading,
        isFetchingNextPage,
        hasNextPage,
        fetchNextPage,
        refetch,
        isRefetching,
    } = useFeed(activeFeed);

    const statuses = useMemo(() => {
        return data?.pages.flatMap(page => page) || [];
    }, [data]);

    const newPosts = useNewPosts(activeFeed, statuses[0]?.id);
    const [loadingNewPosts, setLoadingNewPosts] = useState(false);

    // Reload only the first page (dropping the older ones, so it's one request), then go to the top.
    // Scrolling first would keep the old top post in view, with the new ones above it.
    const showNewPosts = useCallback(async () => {
        setLoadingNewPosts(true);
        try {
            queryClient.setQueryData<InfiniteData<Status[], string | undefined>>(['timeline', activeFeed.id], current =>
                current && { pages: current.pages.slice(0, 1), pageParams: current.pageParams.slice(0, 1) }
            );
            await refetch();
            await scrollListToTop(listRef.current);
        } finally {
            setLoadingNewPosts(false);
        }
    }, [queryClient, activeFeed.id, refetch]);

    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener('status_published', () => {
            queryClient.invalidateQueries({ queryKey: ['timeline', 'home'] });
        });

        const scrollSub = DeviceEventEmitter.addListener('scroll_to_top_home', () => {
            scrollListToTop(listRef.current);
        });

        return () => {
            subscription.remove();
            scrollSub.remove();
        };
    }, [queryClient]);

    const handleRefresh = useCallback(() => {
        refetch();
    }, [refetch]);

    const handleLoadMore = () => {
        if (!isFetchingNextPage && hasNextPage) {
            fetchNextPage();
        }
    };

    const renderFooter = () => {
        if (!isFetchingNextPage) {
            return null;
        }
        return (
            <View style={styles.footer}>
                <ActivityIndicator size={'small'} color={colors.accentColor} />
            </View>
        );
    };

    const renderEmpty = () => {
        if (isLoading) {
            return null;
        }
        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                    {resolveEmptyMessage(activeFeed)}
                </Text>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.feedPicker}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.feedPillsScroll}
                >
                    {pinnedFeeds.map(feed => {
                        const isActive = activeFeed.id === feed.id;
                        return (
                            <Pressable
                                key={feed.id}
                                style={[styles.feedPill, isActive && styles.feedPillActive]}
                                onPress={() => setActiveFeed(feed)}
                                accessibilityRole="tab"
                                accessibilityLabel={feedLabel(feed, i18n)}
                                accessibilityState={{ selected: isActive }}
                                hitSlop={hitSlopFor(0, FEED_PILL_HEIGHT)}
                            >
                                <Ionicons
                                    name={feedIcon(feed.kind)}
                                    size={14}
                                    color={isActive ? colors.buttonTextColor : colors.textSecondary}
                                />
                                <Text style={[type.name, styles.feedPillText, isActive && styles.feedPillTextActive]} numberOfLines={1}>
                                    {feedLabel(feed, i18n)}
                                </Text>
                            </Pressable>
                        );
                    })}
                    <Pressable
                        style={styles.addFeedButton}
                        onPress={() => setFeedsSheetOpen(true)}
                        accessibilityLabel={t('feeds.manageFeeds')}
                        accessibilityRole="button"
                        hitSlop={hitSlopFor(FEED_PILL_HEIGHT, FEED_PILL_HEIGHT)}
                    >
                        <Ionicons name="add" size={18} color={colors.textSecondary} />
                    </Pressable>
                </ScrollView>
            </View>

            {isLoading && statuses.length === 0 ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size={'large'} color={colors.accentColor} />
                </View>
            ) : (
                <View style={styles.list}>
                    {newPosts.count > 0 && <NewPostsPill newPosts={newPosts} loading={loadingNewPosts} onPress={showNewPosts} />}
                    <FlashList
                        ref={listRef}
                        data={statuses}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => <TootCard status={item} onPress={onStatusPress} />}
                        onEndReached={handleLoadMore}
                        onEndReachedThreshold={0.5}
                        refreshControl={
                            <RefreshControl
                                refreshing={isRefetching}
                                onRefresh={handleRefresh}
                                tintColor={colors.accentColor}
                                colors={[colors.accentColor]}
                            />
                        }
                        ListFooterComponent={renderFooter}
                        ListEmptyComponent={renderEmpty}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                    />
                </View>
            )}

            <FeedsSheet
                visible={feedsSheetOpen}
                onClose={() => setFeedsSheetOpen(false)}
                onSelectFeed={setActiveFeed}
                onCreateFeed={() => push({ name: 'feedEditor' })}
                onEditList={listId => push({ name: 'listEditor', listId })}
            />
        </View>
    );
};

export default Timeline;