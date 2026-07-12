import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { View, Text, Avatar, Button, SegmentedControl } from 'react-native-ui-lib';
import Ionicons from '@expo/vector-icons/Ionicons';
import { fetchNotifications } from '../../services/mastodon/notifications';
import { Notification } from '../../services/mastodon/types';
import { useTheme } from '../../services/themeContext';
import { styles } from './styles';

interface NotificationsProps {
    onStatusPress?: (id: string) => void;
}

const Notifications = ({ onStatusPress }: NotificationsProps) => {
    const { colors, isDark } = useTheme();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [activeFilter, setActiveFilter] = useState<'all' | 'mentions' | 'follows'>('all');

    const handleTabChange = (index: number) => {
        const types: ('all' | 'mentions' | 'follows')[] = ['all', 'mentions', 'follows'];
        setActiveFilter(types[index]);
    };

    const filteredNotifications = useMemo(() => {
        if (activeFilter === 'all') return notifications;
        if (activeFilter === 'mentions') return notifications.filter(n => n.type === 'mention');
        if (activeFilter === 'follows') return notifications.filter(n => n.type === 'follow');
        return notifications;
    }, [notifications, activeFilter]);


    const loadNotifications = async (maxId?: string, isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else if (maxId) {
                setLoadingMore(true);
            } else {
                setLoading(true);
            }

            const data = await fetchNotifications(maxId);

            if (data && data.length > 0) {
                setNotifications(prev => {
                    if (isRefresh || !maxId) {
                        return data;
                    }
                    const existingIds = new Set(prev.map(n => n.id));
                    const newItems = data.filter((n: Notification) => !existingIds.has(n.id));
                    return [...prev, ...newItems];
                });
                setHasMore(data.length >= 20);
            } else {
                if (isRefresh || !maxId) {
                    setNotifications([]);
                }
                setHasMore(false);
            }
        } catch (error) {
            console.error('Failed to fetch notifications: ', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
            setLoadingMore(false);
        }
    };

    useEffect(() => {
        loadNotifications();
    }, []);

    const handleRefresh = useCallback(() => {
        loadNotifications(undefined, true);
    }, []);

    const handleLoadMore = () => {
        if (loadingMore || !hasMore || notifications.length === 0) {
            return;
        }
        const lastNotification = notifications[notifications.length - 1];
        loadNotifications(lastNotification.id);
    };

    const stripHtml = (html?: string) => {
        if (!html) return '';
        return html.replace(/<[^>]*>?/gm, '').replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    };

    const renderNotification = ({ item }: { item: Notification }) => {
        let iconName = '';
        let iconColor = '';
        let actionText = '';
        let showPreview = false;
        let isFollow = false;
        let tagText = '';
        let cardBackgroundColor = '';
        let borderColor = '';

        if (item.type === 'favourite') {
            iconName = 'star';
            iconColor = '#0EA5E9';
            cardBackgroundColor = isDark ? 'rgba(14, 165, 233, 0.15)' : 'rgba(14, 165, 233, 0.08)';
            borderColor = isDark ? 'rgba(14, 165, 233, 0.3)' : 'rgba(14, 165, 233, 0.2)';
            tagText = 'FAVOURITE';
            actionText = 'favourited your status';
            showPreview = true;
        } else if (item.type === 'reblog') {
            iconName = 'repeat';
            iconColor = '#F59E0B';
            cardBackgroundColor = isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.08)';
            borderColor = isDark ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.2)';
            tagText = 'BOOST';
            actionText = 'boosted your status';
            showPreview = true;
        } else if (item.type === 'mention') {
            iconName = 'chatbubble';
            iconColor = '#EC4899';
            cardBackgroundColor = isDark ? 'rgba(236, 72, 153, 0.15)' : 'rgba(236, 72, 153, 0.08)';
            borderColor = isDark ? 'rgba(236, 72, 153, 0.3)' : 'rgba(236, 72, 153, 0.2)';
            tagText = 'MENTION';
            actionText = 'mentioned you';
            showPreview = true;
        } else if (item.type === 'follow') {
            iconName = 'person-add';
            iconColor = '#22C55E';
            cardBackgroundColor = isDark ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.08)';
            borderColor = isDark ? 'rgba(34, 197, 94, 0.3)' : 'rgba(34, 197, 94, 0.2)';
            tagText = 'NEW FOLLOWER';
            actionText = 'followed you';
            isFollow = true;
        } else {
            return null; // Skip unsupported types
        }

        return (
            <TouchableOpacity
                style={[styles.notificationCard, { backgroundColor: cardBackgroundColor, borderColor }]}
                onPress={() => item.status && onStatusPress?.(item.status.id)}
                activeOpacity={item.status ? 0.8 : 1}
            >
                {/* Asymmetric Tag Layer */}
                <View style={[styles.asymmetricTagLayer, { backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.7)', borderColor: borderColor, borderWidth: 1 }]}>
                    <Ionicons name={iconName as any} size={14} color={iconColor} />
                    <Text style={[styles.tagText, { color: iconColor }]}>{tagText}</Text>
                </View>

                {/* Header Architecture */}
                <View style={styles.headerArchitecture}>
                    <Avatar source={{ uri: item.account.avatar }} size={42} containerStyle={styles.avatar} />
                    <Text style={[styles.actionText, { color: colors.textPrimary }]}>
                        <Text style={{ fontWeight: 'bold' }}>{item.account.display_name || item.account.username}</Text>
                        <Text>{' '}{actionText}</Text>
                    </Text>
                </View>

                {/* Content Layer */}
                {showPreview && item.status && (
                    <Text
                        style={[
                            styles.statusPreview,
                            { color: colors.textPrimary },
                            item.type === 'mention' && { fontWeight: '600', fontSize: 16 }
                        ]}
                        numberOfLines={3}
                    >
                        {stripHtml(item.status.content)}
                    </Text>
                )}
                {isFollow && (
                    <Button
                        label="Follow back"
                        size={Button.sizes.small}
                        backgroundColor={iconColor}
                        style={styles.followButton}
                        onPress={() => console.log('Follow back pressed')}
                    />
                )}
            </TouchableOpacity>
        );
    };

    const renderFooter = () => {
        if (!loadingMore) return null;
        return (
            <View paddingV-20 center>
                <ActivityIndicator size={'small'} color={colors.accentColor} />
            </View>
        );
    };

    const renderEmpty = () => {
        if (loading) return null;
        return (
            <View flex center padding-40 style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No notifications yet!</Text>
            </View>
        );
    };

    if (loading && notifications.length === 0) {
        return (
            <View flex center style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                <ActivityIndicator size={'large'} color={colors.accentColor} />
            </View>
        );
    }

    return (
        <View flex style={[styles.container, { backgroundColor: colors.background }]}>
            <View paddingH-16 paddingV-10 style={{ zIndex: 10 }}>
                <SegmentedControl
                    segments={[{ label: 'All' }, { label: 'Mentions' }, { label: 'Follows' }]}
                    activeColor={colors.accentColor}
                    onChangeIndex={handleTabChange}
                />
            </View>
            <FlashList
                data={filteredNotifications}
                keyExtractor={(item) => item.id}
                renderItem={renderNotification}
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
};

export default Notifications;
