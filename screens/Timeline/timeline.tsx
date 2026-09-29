import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { ActivityIndicator, RefreshControl, DeviceEventEmitter } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { View, Text } from 'react-native-ui-lib';
import { useQueryClient } from '@tanstack/react-query';
import { useTimeline } from '../../hooks/useTimeline';
import { TootCard } from '../../components/TootCard/tootCard';
import { SegmentedPill } from '../../components/ui';
import { useTheme } from '../../services/themeContext';
import { makeStyles } from './styles';
import { useThemedStyles } from '../../services/theme/useThemedStyles';

type FeedType = 'home' | 'local' | 'federated';

const FEEDS: { value: FeedType; label: string }[] = [
    { value: 'home', label: 'Home' },
    { value: 'local', label: 'Local' },
    { value: 'federated', label: 'Federated' },
];

interface TimelineProps {
    onStatusPress?: (id: string) => void;
}

const Timeline = ({ onStatusPress }: TimelineProps) => {
    const { colors } = useTheme();
    const styles = useThemedStyles(makeStyles);
    const [activeFeed, setActiveFeed] = useState<FeedType>('home');
    const queryClient = useQueryClient();
    const listRef = useRef<any>(null);

    const {
        data,
        isLoading,
        isFetchingNextPage,
        hasNextPage,
        fetchNextPage,
        refetch,
        isRefetching,
    } = useTimeline(activeFeed);

    const statuses = useMemo(() => {
        return data?.pages.flatMap(page => page) || [];
    }, [data]);

    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener('status_published', () => {
            queryClient.invalidateQueries({ queryKey: ['timeline', 'home'] });
        });

        const scrollSub = DeviceEventEmitter.addListener('scroll_to_top_home', () => {
            listRef.current?.scrollToOffset({ offset: 0, animated: true });
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
            <View paddingV-20 center>
                <ActivityIndicator size={'small'} color={colors.accentColor} />
            </View>
        );
    };

    const renderEmpty = () => {
        if (isLoading) {
            return null;
        }
        return (
            <View flex center padding-40 style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                    No toots on your {activeFeed} timeline yet!
                </Text>
            </View>
        );
    };

    return (
        <View flex style={styles.container}>
            <View paddingH-16 paddingV-10>
                <SegmentedPill options={FEEDS} value={activeFeed} onChange={setActiveFeed} />
            </View>
            
            {isLoading && statuses.length === 0 ? (
                <View flex center style={styles.loadingContainer}>
                    <ActivityIndicator size={'large'} color={colors.accentColor} />
                </View>
            ) : (
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
            )}
        </View>
    );
}

export default Timeline;