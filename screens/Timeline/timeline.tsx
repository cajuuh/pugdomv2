import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { ActivityIndicator, RefreshControl, DeviceEventEmitter, ScrollView, TouchableOpacity } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { View, Text, SegmentedControl, Avatar } from 'react-native-ui-lib';
import { useQueryClient } from '@tanstack/react-query';
import { useTimeline } from '../../hooks/useTimeline';
import { TootCard } from '../../components/TootCard/tootCard';
import { useTheme } from '../../services/themeContext';
import { styles } from './styles';

type FeedType = 'home' | 'local' | 'federated';

interface TimelineProps {
    onStatusPress?: (id: string) => void;
}

const mockPeers = [
    { id: '1', name: 'cajuuh', avatar: 'https://placekitten.com/100/100', active: true },
    { id: '2', name: 'pug_lover', avatar: 'https://placekitten.com/101/101', active: true },
    { id: '3', name: 'mastodon', avatar: 'https://placekitten.com/102/102', active: false },
    { id: '4', name: 'news', avatar: 'https://placekitten.com/103/103', active: true },
    { id: '5', name: 'tech', avatar: 'https://placekitten.com/104/104', active: false },
];

const ActivePeerRings = ({ colors }: { colors: any }) => (
    <View style={{ paddingVertical: 12 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
            {mockPeers.map(peer => (
                <TouchableOpacity key={peer.id} style={{ alignItems: 'center', gap: 4 }} activeOpacity={0.7}>
                    <View style={{ 
                        padding: 2, 
                        borderRadius: 30, 
                        borderWidth: 2, 
                        borderColor: peer.active ? colors.accentColor : 'transparent' 
                    }}>
                        <Avatar source={{ uri: peer.avatar }} size={52} />
                    </View>
                    <Text style={{ fontSize: 11, color: colors.textSecondary }} numberOfLines={1}>{peer.name}</Text>
                </TouchableOpacity>
            ))}
        </ScrollView>
    </View>
);

const Timeline = ({ onStatusPress }: TimelineProps) => {
    const { colors } = useTheme();
    const [activeFeed, setActiveFeed] = useState<FeedType>('home');
    const queryClient = useQueryClient();
    const listRef = useRef<FlashList<any>>(null);

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
                <ActivityIndicator size={'small'} color={'#6366F1'} />
            </View>
        );
    };

    const renderEmpty = () => {
        if (isLoading) {
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
            
            {isLoading && statuses.length === 0 ? (
                <View flex center style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                    <ActivityIndicator size={'large'} color={colors.accentColor} />
                </View>
            ) : (
                <FlashList
                    ref={listRef}
                    estimatedItemSize={200}
                    data={statuses}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => <TootCard status={item} onPress={() => onStatusPress?.(item.id)} />}
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
                    ListHeaderComponent={<ActivePeerRings colors={colors} />}
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