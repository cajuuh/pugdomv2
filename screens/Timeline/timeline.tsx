import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { ActivityIndicator, AppState, RefreshControl, DeviceEventEmitter, Pressable, ScrollView, Text, View } from 'react-native';
import { FlashList, FlashListRef, ViewToken } from '@shopify/flash-list';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Icon } from '../../components/ui/icon';
import { useFeed } from '../../hooks/useFeed';
import { usePinnedFeeds } from '../../hooks/usePinnedFeeds';
import { Status } from '../../services/mastodon/types';
import { DEFAULT_PINNED_FEEDS, FeedDescriptor, feedIcon, feedLabel } from '../../services/mastodon/feedTypes';
import { TootCard } from '../../components/TootCard/tootCard';
import { FeedsSheet } from '../../components/FeedsSheet/feedsSheet';
import { FEED_CREATED_EVENT, FEED_OPEN_EVENT } from '../FeedEditor/feedEditor';
import { useNavigator } from '../../services/navigationContext';
import { hitSlopFor, space } from '../../services/theme/shape';
import { useTheme } from '../../services/themeContext';
import { useSettings } from '../../services/settingsContext';
import { useAuth } from '../../services/authContext';
import { homeShows } from '../../services/mastodon/feedService';
import { FEED_PILL_HEIGHT, makeStyles } from './styles';
import { useThemedStyles } from '../../services/theme/useThemedStyles';
import { useI18n } from '../../services/i18n/i18nContext';
import { postListProps, setAutoplayPost } from '../../services/media/autoplay';
import { useNewPosts } from '../../hooks/useNewPosts';
import { feedFilterContext, filterMatch } from '../../services/mastodon/filters';
import { NewPostsPill } from './newPostsPill';
import { GapRow } from './gapRow';
import { TAB_BAR_CLEARANCE } from '../../components/TabBar/styles';
import { compareIds, FeedItem, Gap, GapEnd, isGap } from '../../services/mastodon/timelineGaps';
import { saveHomeMarker } from '../../services/mastodon/markers';
import { dialog } from '../../services/dialog';

// How far a sideways drag has to travel to change the feed, in points
const SWIPE_FEED_AT = 60;

// FlashList keeps the first visible post in place while posts above it get measured, which cut an
// animated scrollToOffset(0) short after scrolling far. scrollToIndex pauses that correction, jumps
// near the top and animates the rest; then settle on offset 0 (the list's top padding).
export const scrollListToTop = async <T,>(list: Pick<FlashListRef<T>, 'scrollToIndex' | 'scrollToOffset'> | null) => {
    if (!list) return;
    await list.scrollToIndex({ index: 0, animated: true });
    list.scrollToOffset({ offset: 0, animated: true });
};

// The pill for the feed you're already on: back to its top
const SCROLL_FEED_TO_TOP = 'scroll_feed_to_top';

interface FeedListProps {
    feed: FeedDescriptor;
    // The feed picked in the pills. The others stay mounted, hidden, to keep their place
    current: boolean;
    // Current, and its tab is showing
    visible: boolean;
    onStatusPress?: (id: string) => void;
}

const FeedList = ({ feed, current, visible, onStatusPress }: FeedListProps) => {
    const { colors } = useTheme();
    const styles = useThemedStyles(makeStyles);
    const { t } = useI18n();
    const listRef = useRef<FlashListRef<FeedItem>>(null);

    const { homeBoosts, homeReplies } = useSettings();
    const { user } = useAuth();
    const filterContext = feedFilterContext(feed.kind);
    // Hide filters drop posts; on Home, the boosts and replies switches too
    const shows = useMemo(() => {
        const home = feed.kind === 'home' && !(homeBoosts && homeReplies) ? homeShows(homeBoosts, homeReplies, user?.id) : undefined;
        return (post: Status) => filterMatch(post, filterContext)?.action !== 'hide' && (!home || home(post));
    }, [feed.kind, filterContext, homeBoosts, homeReplies, user?.id]);

    const resolveEmptyMessage = () => {
        if (feed.kind === 'home') return t('timeline.emptyHome');
        if (feed.kind === 'local') return t('timeline.emptyLocal');
        if (feed.kind === 'federated') return t('timeline.emptyFederated');
        if (feed.kind === 'trending') return t('timeline.emptyTrending');
        if (feed.kind === 'hashtag') return t('timeline.emptyHashtag');
        return t('timeline.emptyHome');
    };

    const {
        isLoading,
        isFetchingNextPage,
        hasNextPage,
        fetchNextPage,
        posts,
        items,
        restoredTo,
        loadNewest,
        loadGap,
        loadingGap,
    } = useFeed(feed, shows);

    const newPosts = useNewPosts(feed, posts[0]?.id, current, shows);
    const [loadingNewPosts, setLoadingNewPosts] = useState(false);
    // Open again for the next new posts, once these are loaded
    const [newPostsCollapsed, setNewPostsCollapsed] = useState(false);
    useEffect(() => {
        if (newPosts.count === 0) setNewPostsCollapsed(false);
    }, [newPosts.count]);
    // The newest post the list has drawn, and a wait for the reloaded one to be drawn
    const drawnTopId = useRef<string | undefined>(undefined);
    const waitingForTop = useRef<{ id: string; drawn: () => void } | null>(null);

    // Scrolling before the new posts are drawn lands on the old top post: once they're drawn,
    // FlashList keeps it in place and the new posts end up above
    useEffect(() => {
        drawnTopId.current = posts[0]?.id;
        const waiting = waitingForTop.current;
        if (!waiting) return;
        waitingForTop.current = null;
        if (waiting.id === drawnTopId.current) scrollListToTop(listRef.current).finally(waiting.drawn);
        else waiting.drawn();
    }, [posts]);

    // The newest posts on top (a gap under them if they don't reach what's loaded), then go there.
    // Scrolling first would keep the old top post in view, with the new ones above it.
    const showNewPosts = useCallback(async () => {
        setLoadingNewPosts(true);
        try {
            const topId = await loadNewest();
            if (topId) {
                await new Promise<void>(drawn => {
                    if (topId === drawnTopId.current) scrollListToTop(listRef.current).finally(drawn);
                    else waitingForTop.current = { id: topId, drawn };
                });
            }
        } catch (error) {
            console.warn('Loading new posts failed:', error);
            dialog.toast(t('timeline.loadFailed'));
        } finally {
            setLoadingNewPosts(false);
        }
    }, [loadNewest, t]);

    // After filling a gap, keep reading the way you were going: up to the newer posts just above
    // where you were, or down from where you were
    const continueAt = useRef<{ ids: Set<string>; from: GapEnd } | null>(null);
    const scrollToLoaded = useCallback((list: FeedItem[]) => {
        const pending = continueAt.current;
        if (!pending) return;
        const indexes = list.map((item, index) => (pending.ids.has(item.id) ? index : -1)).filter(index => index >= 0);
        if (!indexes.length) return;
        continueAt.current = null;
        const newer = pending.from === 'newer';
        // At the bottom, clear of the dock
        listRef.current?.scrollToIndex({
            index: newer ? indexes[indexes.length - 1] : indexes[0],
            viewPosition: newer ? 1 : 0,
            viewOffset: newer ? -TAB_BAR_CLEARANCE : 0,
            animated: true,
        });
    }, []);
    useEffect(() => scrollToLoaded(items), [items, scrollToLoaded]);
    const fillGap = useCallback(async (gap: Gap, from: GapEnd) => {
        try {
            const loaded = await loadGap(gap, from);
            continueAt.current = { ids: new Set(loaded.map(post => post.id)), from };
        } catch (error) {
            console.warn('Loading missing posts failed:', error);
            dialog.toast(t('timeline.loadFailed'));
        }
    }, [loadGap, t]);

    // Home reopened where you left it starts on that post
    const startAt = useRef<number | undefined>(undefined);
    if (startAt.current === undefined && items.length) {
        startAt.current = restoredTo ? Math.max(0, items.findIndex(item => !isGap(item) && compareIds(item.id, restoredTo) <= 0)) : 0;
    }

    // Home's place is saved on the server (the home marker) as the app leaves the screen
    const firstOnScreen = useRef<string | undefined>(undefined);
    const onViewableItemsChanged = useCallback((info: { viewableItems: ViewToken<FeedItem>[]; changed: ViewToken<FeedItem>[] }) => {
        postListProps.onViewableItemsChanged(info);
        const first = info.viewableItems.find(token => token.item && !isGap(token.item));
        if (first) firstOnScreen.current = first.item.id;
    }, []);
    useEffect(() => {
        if (feed.kind !== 'home') return;
        let saved: string | undefined;
        const subscription = AppState.addEventListener('change', state => {
            const id = firstOnScreen.current;
            if (state !== 'background' || !id || id === saved) return;
            saved = id;
            saveHomeMarker(id).catch(error => console.warn('Saving the Home position failed:', error));
        });
        // Your own new post shows on top, without reloading Home (that would lose a restored place)
        const published = DeviceEventEmitter.addListener('status_published', () => {
            loadNewest().catch(error => console.warn('Loading new posts failed:', error));
        });
        return () => {
            subscription.remove();
            published.remove();
        };
    }, [feed.kind, loadNewest]);

    useEffect(() => {
        if (!current) return;
        // Home tapped on Home: the newest posts, from the top
        const newest = DeviceEventEmitter.addListener('scroll_to_top_home', showNewPosts);
        const top = DeviceEventEmitter.addListener(SCROLL_FEED_TO_TOP, () => scrollListToTop(listRef.current));
        return () => {
            newest.remove();
            top.remove();
        };
    }, [current, showNewPosts]);

    // Hidden, its video stops; scrolling it again starts it again
    useEffect(() => {
        if (!visible) setAutoplayPost(null);
    }, [visible]);

    // The spinner is only for a pull: background reloads (the new posts pill, following someone)
    // don't show it
    const [pulling, setPulling] = useState(false);
    const handleRefresh = useCallback(async () => {
        setPulling(true);
        try {
            await showNewPosts();
        } finally {
            setPulling(false);
        }
    }, [showNewPosts]);

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
                    {resolveEmptyMessage()}
                </Text>
            </View>
        );
    };

    return (
        <View style={[styles.list, !current && styles.hidden]}>
            {isLoading && items.length === 0 ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size={'large'} color={colors.accentColor} />
                </View>
            ) : (
                <>
                    {newPosts.count > 0 && <NewPostsPill newPosts={newPosts} loading={loadingNewPosts} collapsed={newPostsCollapsed} onPress={showNewPosts} />}
                    <FlashList
                        {...postListProps}
                        ref={listRef}
                        onScrollBeginDrag={() => {
                            if (newPosts.count > 0) setNewPostsCollapsed(true);
                        }}
                        onViewableItemsChanged={onViewableItemsChanged}
                        data={items}
                        initialScrollIndex={startAt.current || undefined}
                        keyExtractor={(item) => item.id}
                        getItemType={item => (isGap(item) ? 'gap' : 'post')}
                        renderItem={({ item }) =>
                            isGap(item) ? (
                                <GapRow gap={item} loading={loadingGap === item.id} onLoad={fillGap} />
                            ) : (
                                <TootCard status={item} onPress={onStatusPress} remote={feed.kind === 'server'} filterContext={filterContext} />
                            )
                        }
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
                </>
            )}
        </View>
    );
};

interface TimelineProps {
    onStatusPress?: (id: string) => void;
    // False while another tab is open over it (it stays mounted to keep its place)
    active?: boolean;
}

const Timeline = ({ onStatusPress, active = true }: TimelineProps) => {
    const { colors, type } = useTheme();
    const styles = useThemedStyles(makeStyles);
    const i18n = useI18n();
    const { t } = i18n;
    const { push } = useNavigator();
    const { pinnedFeeds, pinFeed } = usePinnedFeeds();
    const { swipeFeeds } = useSettings();

    const [activeFeed, setActiveFeed] = useState<FeedDescriptor>(DEFAULT_PINNED_FEEDS[0]);
    // Opened from the Feeds sheet or the server screen: it may not be pinned, and then shows as a
    // preview pill until you switch to a pinned one
    const [previewing, setPreviewing] = useState(false);
    const [feedsSheetOpen, setFeedsSheetOpen] = useState(false);
    const pillsRef = useRef<ScrollView>(null);
    const pillX = useRef<Record<string, number>>({});

    const openFeed = useCallback((feed: FeedDescriptor) => {
        setActiveFeed(feed);
        setPreviewing(true);
        // The preview pill comes first
        pillsRef.current?.scrollTo({ x: 0, animated: true });
    }, []);

    // Another feed switches to it; the one you're on goes back to its top, like Home in the dock
    const selectPinned = (feed: FeedDescriptor) => {
        if (feed.id === activeFeed.id) {
            DeviceEventEmitter.emit(SCROLL_FEED_TO_TOP);
            return;
        }
        setActiveFeed(feed);
        setPreviewing(false);
    };

    // A sideways swipe moves through the pinned feeds, stopping at the ends. A preview (index -1)
    // sits before them. Starts only after a clear sideways drag, and never during a scroll.
    const swipe = Gesture.Pan()
        .withTestId('swipe-feeds')
        .enabled(swipeFeeds)
        .runOnJS(true)
        .activeOffsetX([-24, 24])
        .failOffsetY([-20, 20])
        .onEnd((event, success) => {
            if (!success || Math.abs(event.translationX) < SWIPE_FEED_AT) return;
            const index = pinnedFeeds.findIndex(feed => feed.id === activeFeed.id);
            const next = pinnedFeeds[index + (event.translationX < 0 ? 1 : -1)];
            if (!next) return;
            selectPinned(next);
            // Keep its pill in view. Leaving a preview moves the pills, so their saved spots are old.
            const x = index < 0 ? 0 : (pillX.current[next.id] ?? 0) - space.lg;
            pillsRef.current?.scrollTo({ x: Math.max(0, x), animated: true });
        });

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

    // If the open feed gets unpinned (or its list deleted), go back to Home, wherever its pill is
    useEffect(() => {
        if (!activeIsPinned && !previewing) {
            setActiveFeed(DEFAULT_PINNED_FEEDS[0]);
        }
    }, [activeIsPinned, previewing]);

    // Each pinned feed you've opened keeps its own mounted list, so coming back finds your place. A
    // preview goes when you leave it.
    // ponytail: no limit but the pinned feeds, drop the least recently used if memory ever matters
    const visited = useRef(new Set<string>());
    visited.current.add(activeFeed.id);
    // Sorted, so rearranging the pills never moves a mounted list and risks its scroll position
    const visitedPinned = pinnedFeeds.filter(feed => visited.current.has(feed.id)).sort((a, b) => a.id.localeCompare(b.id));
    const mountedFeeds = activeIsPinned ? visitedPinned : [activeFeed, ...visitedPinned];

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
                                <Icon name={feedIcon(previewFeed.kind)} size={14} color={colors.buttonTextColor} />
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
                                <Icon name="pin-outline" size={16} color={colors.accentText} />
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
                                onLayout={event => {
                                    pillX.current[feed.id] = event.nativeEvent.layout.x;
                                }}
                                accessibilityRole="tab"
                                accessibilityLabel={feedLabel(feed, i18n)}
                                accessibilityState={{ selected: isActive }}
                                hitSlop={hitSlopFor(0, FEED_PILL_HEIGHT)}
                            >
                                <Icon
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
                        <Icon name="add" size={18} color={colors.textSecondary} />
                    </Pressable>
                </ScrollView>
            </View>

            <GestureDetector gesture={swipe}>
                <View style={styles.list}>
                    {mountedFeeds.map(feed => (
                        <FeedList
                            key={feed.id}
                            feed={feed}
                            current={feed.id === activeFeed.id}
                            visible={active && feed.id === activeFeed.id}
                            onStatusPress={onStatusPress}
                        />
                    ))}
                </View>
            </GestureDetector>

            <FeedsSheet
                visible={feedsSheetOpen}
                onClose={() => setFeedsSheetOpen(false)}
                onSelectFeed={openFeed}
                onEditFeed={feed => push({ name: 'feedEditor', feed })}
                onEditList={listId => push({ name: 'listEditor', listId })}
                onAddServer={() => push({ name: 'serverPicker' })}
            />
        </View>
    );
};

export default Timeline;