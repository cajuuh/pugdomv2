import React, { useEffect, useState, useCallback } from 'react';
import { FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { View, Text } from 'react-native-ui-lib';
import { fetchHomeTimeline } from '../../services/mastodon/timeline';
import { Status } from '../../services/mastodon/types';
import { TootCard } from '../../components/TootCard/tootCard';
import { useTheme } from '../../services/themeContext';
import { styles } from './styles';

const Timeline = () => {
    const { colors } = useTheme();
    const [statuses, setStatuses] = useState<Status[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const loadTimeline = async (maxId?: string, isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else if (maxId) {
                setLoadingMore(true);
            } else {
                setLoading(true);
            }

            const data = await fetchHomeTimeline(maxId);

            if (data && data.length > 0) {
                setStatuses(prev => {
                    if (isRefresh || !maxId) {
                        return data;
                    }
                    const existingIds = new Set(prev.map(status => status.id));
                    const newItems = data.filter((status: Status) => !existingIds.has(status.id));
                    return [...prev, ...newItems];
                });
                setHasMore(data.length >= 20);
            } else {
                if (isRefresh || !maxId) {
                    setStatuses([]);
                }
                setHasMore(false);
            }
        } catch (error) {
            console.error('Failed to fetch home timeline: ', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
            setLoadingMore(false);
        }
    }

    useEffect(() => {
        loadTimeline();
    }, []);

    const handleRefresh = useCallback(() => {
        loadTimeline(undefined, true); //force refresh using undefined params
    }, []);

    const handleLoadMore = () => {
        if (loadingMore || !hasMore || statuses.length === 0) {
            return;
        }
        const lastStatus = statuses[statuses.length - 1];
        loadTimeline(lastStatus.id);
    };

    const renderFooter = () => {
        if (!loadingMore) {
            return null;
        }
        return (
            <View paddingV-20 center>
                <ActivityIndicator size={'small'} color={'#6366F1'} />
            </View>
        );
    };

    const renderEmpty = () => {
        if (loading) {
            return null;
        }
        return (
            <View flex center padding-40 style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No toots on your home timeline yet!</Text>
            </View>
        );
    };

    if (loading && statuses.length === 0) {
        return (
            <View flex center style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                <ActivityIndicator size={'large'} color={colors.accentColor} />
            </View>
        );
    };

    return (
        <View flex style={[styles.container, { backgroundColor: colors.background }]}>
            <FlatList
                data={statuses}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <TootCard status={item} />}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
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
    );
}

export default Timeline;