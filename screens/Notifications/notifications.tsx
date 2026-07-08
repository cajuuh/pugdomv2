import React, { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { View, Text, Avatar, Button } from 'react-native-ui-lib';
import Ionicons from '@expo/vector-icons/Ionicons';
import { fetchNotifications } from '../../services/mastodon/notifications';
import { Notification } from '../../services/mastodon/types';
import { useTheme } from '../../services/themeContext';
import { styles } from './styles';

interface NotificationsProps {
    onStatusPress?: (id: string) => void;
}

const Notifications = ({ onStatusPress }: NotificationsProps) => {
    const { colors } = useTheme();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);

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

        if (item.type === 'favourite') {
            iconName = 'star';
            iconColor = colors.warningColor; 
            actionText = 'favourited your status';
            showPreview = true;
        } else if (item.type === 'reblog') {
            iconName = 'repeat';
            iconColor = colors.accentColor; 
            actionText = 'boosted your status';
            showPreview = true;
        } else if (item.type === 'mention') {
            iconName = 'chatbubble';
            iconColor = colors.accentColor; 
            actionText = 'mentioned you';
            showPreview = true;
        } else if (item.type === 'follow') {
            iconName = 'person-add';
            iconColor = colors.accentColor; 
            actionText = 'followed you';
            isFollow = true;
        } else {
            return null; // Skip unsupported types
        }

        return (
            <TouchableOpacity 
                style={[styles.notificationCard, { borderBottomColor: colors.borderColor }]} 
                onPress={() => item.status && onStatusPress?.(item.status.id)}
                activeOpacity={item.status ? 0.8 : 1}
            >
                <View style={styles.iconContainer}>
                    <Ionicons name={iconName as any} size={28} color={iconColor} />
                </View>
                <View style={styles.contentContainer}>
                    <View style={styles.headerRow}>
                        <Avatar source={{ uri: item.account.avatar }} size={36} containerStyle={styles.avatar} />
                        <Text style={[styles.actionText, { color: colors.textPrimary }]}>
                            <Text style={{ fontWeight: 'bold' }}>{item.account.display_name || item.account.username}</Text> {actionText}
                        </Text>
                    </View>
                    {showPreview && item.status && (
                        <Text 
                            style={[styles.statusPreview, { color: colors.textSecondary }]} 
                            numberOfLines={3}
                        >
                            {stripHtml(item.status.content)}
                        </Text>
                    )}
                    {isFollow && (
                        <View style={{ marginTop: 8, alignSelf: 'flex-start' }}>
                            <Button
                                label="Follow back"
                                size={Button.sizes.small}
                                backgroundColor={colors.accentColor}
                                style={styles.followButton}
                                onPress={() => console.log('Follow back pressed')}
                            />
                        </View>
                    )}
                </View>
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
            <FlashList
                estimatedItemSize={150}
                data={notifications}
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
