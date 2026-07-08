import React, { useEffect, useState, useCallback } from 'react';
import { FlatList, ActivityIndicator, RefreshControl, DeviceEventEmitter } from 'react-native';
import { View, Text, SegmentedControl } from 'react-native-ui-lib';
import { fetchHomeTimeline, fetchPublicTimeline } from '../../services/mastodon/timeline';
import { Status } from '../../services/mastodon/types';
import { TootCard } from '../../components/TootCard/tootCard';
import { useTheme } from '../../services/themeContext';
import { styles } from './styles';

type FeedType = 'home' | 'local' | 'federated';

interface TimelineProps {
    onStatusPress?: (id: string) => void;
}

interface FeedState {
    statuses: Status[];
    hasMore: boolean;
    loading: boolean;
    refreshing: boolean;
    loadingMore: boolean;
}

const initialFeedState: FeedState = {
    statuses: [],
    hasMore: true,
    loading: true,
    refreshing: false,
    loadingMore: false,
};

const Timeline = ({ onStatusPress }: TimelineProps) => {
    const { colors } = useTheme();
    const [activeFeed, setActiveFeed] = useState<FeedType>('home');
    
    const [feeds, setFeeds] = useState<Record<FeedType, FeedState>>({
        home: { ...initialFeedState },
        local: { ...initialFeedState },
        federated: { ...initialFeedState },
    });

    const currentFeed = feeds[activeFeed];

    const loadTimeline = async (type: FeedType, maxId?: string, isRefresh = false) => {
        setFeeds(prev => ({
            ...prev,
            [type]: {
                ...prev[type],
                refreshing: isRefresh,
                loadingMore: !!maxId && !isRefresh,
                loading: !maxId && !isRefresh && prev[type].statuses.length === 0,
            }
        }));

        try {
            let data: Status[] = [];
            if (type === 'home') {
                data = await fetchHomeTimeline(maxId);
            } else if (type === 'local') {
                data = await fetchPublicTimeline(maxId, true);
            } else if (type === 'federated') {
                data = await fetchPublicTimeline(maxId, false);
            }

            if (data && data.length > 0) {
                setFeeds(prev => {
                    const prevFeed = prev[type];
                    let newStatuses = data;
                    if (!isRefresh && maxId) {
                        const existingIds = new Set(prevFeed.statuses.map(s => s.id));
                        const newItems = data.filter(s => !existingIds.has(s.id));
                        newStatuses = [...prevFeed.statuses, ...newItems];
                    }
                    return {
                        ...prev,
                        [type]: {
                            ...prevFeed,
                            statuses: newStatuses,
                            hasMore: data.length >= 20,
                            loading: false,
                            refreshing: false,
                            loadingMore: false,
                        }
                    };
                });
            } else {
                setFeeds(prev => ({
                    ...prev,
                    [type]: {
                        ...prev[type],
                        statuses: (isRefresh || !maxId) ? [] : prev[type].statuses,
                        hasMore: false,
                        loading: false,
                        refreshing: false,
                        loadingMore: false,
                    }
                }));
            }
        } catch (error) {
            console.error(`Failed to fetch ${type} timeline: `, error);
            setFeeds(prev => ({
                ...prev,
                [type]: {
                    ...prev[type],
                    loading: false,
                    refreshing: false,
                    loadingMore: false,
                }
            }));
        }
    };

    useEffect(() => {
        if (feeds[activeFeed].statuses.length === 0 && feeds[activeFeed].loading) {
            loadTimeline(activeFeed);
        }
    }, [activeFeed]);

    useEffect(() => {
        // Initial load for home is handled by the other useEffect when activeFeed is initially 'home'

        const subscription = DeviceEventEmitter.addListener('status_published', () => {
            loadTimeline('home', undefined, true); // force reload timeline on new status
        });

        return () => {
            subscription.remove();
        };
    }, []);

    const handleRefresh = useCallback(() => {
        loadTimeline(activeFeed, undefined, true);
    }, [activeFeed]);

    const handleLoadMore = () => {
        if (currentFeed.loadingMore || !currentFeed.hasMore || currentFeed.statuses.length === 0) {
            return;
        }
        const lastStatus = currentFeed.statuses[currentFeed.statuses.length - 1];
        loadTimeline(activeFeed, lastStatus.id);
    };

    const renderFooter = () => {
        if (!currentFeed.loadingMore) {
            return null;
        }
        return (
            <View paddingV-20 center>
                <ActivityIndicator size={'small'} color={'#6366F1'} />
            </View>
        );
    };

    const renderEmpty = () => {
        if (currentFeed.loading) {
            return null;
        }
        return (
            <View flex center padding-40 style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    No toots on your {activeFeed} timeline yet!
                </Text>
            </View>
        );
    };

    const handleTabChange = (index: number) => {
        const types: FeedType[] = ['home', 'local', 'federated'];
        setActiveFeed(types[index]);
    };

    return (
        <View flex style={[styles.container, { backgroundColor: colors.background }]}>
            <View paddingH-16 paddingV-10>
                <SegmentedControl
                    segments={[{ label: 'Home' }, { label: 'Local' }, { label: 'Federated' }]}
                    activeColor={colors.accentColor}
                    onChangeIndex={handleTabChange}
                />
            </View>
            
            {currentFeed.loading && currentFeed.statuses.length === 0 ? (
                <View flex center style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                    <ActivityIndicator size={'large'} color={colors.accentColor} />
                </View>
            ) : (
                <FlatList
                    data={currentFeed.statuses}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => <TootCard status={item} onPress={() => onStatusPress?.(item.id)} />}
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.5}
                    refreshControl={
                        <RefreshControl
                            refreshing={currentFeed.refreshing}
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
            )}
        </View>
    );
}

export default Timeline;