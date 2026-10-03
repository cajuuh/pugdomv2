import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { ActivityIndicator, RefreshControl, DeviceEventEmitter, Text, View } from 'react-native';
import { FlashList, FlashListRef } from '@shopify/flash-list';
import { useQueryClient } from '@tanstack/react-query';
import { useTimeline } from '../../hooks/useTimeline';
import { Status } from '../../services/mastodon/types';
import { TootCard } from '../../components/TootCard/tootCard';
import { SegmentedPill } from '../../components/ui';
import { useTheme } from '../../services/themeContext';
import { makeStyles } from './styles';
import { useThemedStyles } from '../../services/theme/useThemedStyles';
import { useI18n } from '../../services/i18n/i18nContext';

type FeedType = 'home' | 'local' | 'federated';

const FEEDS: FeedType[] = ['home', 'local', 'federated'];
const EMPTY_KEY = { home: 'timeline.emptyHome', local: 'timeline.emptyLocal', federated: 'timeline.emptyFederated' } as const;

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
    const { colors } = useTheme();
    const styles = useThemedStyles(makeStyles);
    const { t } = useI18n();
    const feeds = useMemo(() => FEEDS.map(value => ({ value, label: t(`timeline.${value}`) })), [t]);
    const [activeFeed, setActiveFeed] = useState<FeedType>('home');
    const queryClient = useQueryClient();
    const listRef = useRef<FlashListRef<Status>>(null);

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
                    {t(EMPTY_KEY[activeFeed])}
                </Text>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.feedPicker}>
                <SegmentedPill options={feeds} value={activeFeed} onChange={setActiveFeed} />
            </View>
            
            {isLoading && statuses.length === 0 ? (
                <View style={styles.loadingContainer}>
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