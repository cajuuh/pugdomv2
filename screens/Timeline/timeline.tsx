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
import { FEED_CREATED_EVENT, FEED_OPEN_EVENT } from '../FeedEditor/feedEditor';
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
    const { pinnedFeeds, pinFeed } = usePinnedFeeds();

    const [activeFeed, setActiveFeed] = useState<FeedDescriptor>(DEFAULT_PINNED_FEEDS[0]);
    // Opened from the Feeds sheet or the server screen: it may not be pinned, and then shows as a
    // preview pill until you switch to a pinned one
    const [previewing, setPreviewing] = useState(false);
    const [feedsSheetOpen, setFeedsSheetOpen] = useState(false);
    const queryClient = useQueryClient();
    const listRef = useRef<FlashListRef<Status>>(null);
    const pillsRef = useRef<ScrollView>(null);

    const openFeed = useCallback((feed: FeedDescriptor) => {
        setActiveFeed(feed);
        setPreviewing(true);
        // The preview pill comes first
        pillsRef.current?.scrollTo({ x: 0, animated: true });
    }, []);

    const selectPinned = (feed: FeedDescriptor) => {
        setActiveFeed(feed);
        setPreviewing(false);
    };

    // A feed made in the editor, or one picked elsewhere, opens straight away
    useEffect(() => {
        const created = DeviceEventEmitter.addListener(FEED_CREATED_EVENT, openFeed);
        const opened = DeviceEventEmitter.addListener(FEED_OPEN_EVENT, openFeed);
        return () => {
            created.remove();
            opened.remove();
        };
    }, [openFeed]);

    const activeIsPinned = pinnedFeeds.some(f => f.id === activeFeed.id);
    const previewFeed = previewing && !activeIsPinned ? activeFeed : null;

    // If the open feed gets unpinned (or its list deleted), go back to the first pinned one (Home)
    useEffect(() => {
        if (!activeIsPinned && !previewing) {
            setActiveFeed(pinnedFeeds[0] || DEFAULT_PINNED_FEEDS[0]);
        }
    }, [pinnedFeeds, activeIsPinned, previewing]);

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
    } = useFeed(activeFeed);

    const statuses = useMemo(() => {
        return data?.pages.flatMap(page => page) || [];
    }, [data]);

    const newPosts = useNewPosts(activeFeed, statuses[0]?.id);
    const [loadingNewPosts, setLoadingNewPosts] = useState(false);
    // The newest post the list has drawn, and a wait for the reloaded one to be drawn
    const drawnTopId = useRef<string | undefined>(undefined);
    const waitingForTop = useRef<{ id: string; drawn: () => void } | null>(null);

    // Scrolling before the reloaded posts are drawn lands on the old top post: once they're drawn,
    // FlashList keeps it in place and the new posts end up above
    useEffect(() => {
        drawnTopId.current = statuses[0]?.id;
        const waiting = waitingForTop.current;
        if (!waiting) return;
        waitingForTop.current = null;
        if (waiting.id === drawnTopId.current) scrollListToTop(listRef.current).finally(waiting.drawn);
        else waiting.drawn();
    }, [statuses]);

    // Reload only the first page (dropping the older ones, so it's one request), then go to the top.
    // Scrolling first would keep the old top post in view, with the new ones above it.
    const showNewPosts = useCallback(async () => {
        setLoadingNewPosts(true);
        try {
            queryClient.setQueryData<InfiniteData<Status[], string | undefined>>(['timeline', activeFeed.id], current =>
                current && { pages: current.pages.slice(0, 1), pageParams: current.pageParams.slice(0, 1) }
            );
            const { data: fresh } = await refetch();
            const topId = fresh?.pages[0]?.[0]?.id;
            if (topId) {
                await new Promise<void>(drawn => {
                    if (topId === drawnTopId.current) scrollListToTop(listRef.current).finally(drawn);
                    else waitingForTop.current = { id: topId, drawn };
                });
            }
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

    // The spinner is only for a pull: background reloads (switching feeds back, the new posts pill,
    // following someone) don't show it
    const [pulling, setPulling] = useState(false);
    const handleRefresh = useCallback(async () => {
        setPulling(true);
        try {
            await refetch();
        } finally {
            setPulling(false);
        }
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
                    ref={pillsRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.feedPillsScroll}
                >
                    {previewFeed && (
                        <>
                            <View
                                style={[styles.feedPill, styles.feedPillActive, styles.feedPillPreview]}
                                accessible
                                accessibilityRole="tab"
                                accessibilityLabel={feedLabel(previewFeed, i18n)}
                                accessibilityState={{ selected: true }}
                            >
                                <Ionicons name={feedIcon(previewFeed.kind)} size={14} color={colors.buttonTextColor} />
                                <Text style={[type.name, styles.feedPillText, styles.feedPillTextActive]} numberOfLines={1}>
                                    {feedLabel(previewFeed, i18n)}
                                </Text>
                            </View>
                            <Pressable
                                style={styles.addFeedButton}
                                onPress={() => pinFeed(previewFeed)}
                                accessibilityLabel={t('feeds.pinFeed', { feed: feedLabel(previewFeed, i18n) })}
                                accessibilityRole="button"
                                hitSlop={hitSlopFor(FEED_PILL_HEIGHT, FEED_PILL_HEIGHT)}
                            >
                                <Ionicons name="pin-outline" size={16} color={colors.accentText} />
                            </Pressable>
                            <View style={styles.feedPillDivider} />
                        </>
                    )}
                    {pinnedFeeds.map(feed => {
                        const isActive = activeFeed.id === feed.id;
                        return (
                            <Pressable
                                key={feed.id}
                                style={[styles.feedPill, isActive && styles.feedPillActive]}
                                onPress={() => selectPinned(feed)}
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
                        renderItem={({ item }) => <TootCard status={item} onPress={onStatusPress} remote={activeFeed.kind === 'server'} />}
                        onEndReached={handleLoadMore}
                        onEndReachedThreshold={0.5}
                        refreshControl={
                            <RefreshControl
                                refreshing={pulling}
                                onRefresh={handleRefresh}
                                tintColor={colors.accentColor}
                                colors={[colors.accentColor]}
                                progressBackgroundColor={colors.cardBackground}
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
                onSelectFeed={openFeed}
                onCreateFeed={() => push({ name: 'feedEditor' })}
                onEditList={listId => push({ name: 'listEditor', listId })}
                onAddServer={() => push({ name: 'serverPicker' })}
            />
        </View>
    );
};

export default Timeline;