import React, { useEffect, useState, useCallback } from 'react';
import { FlatList, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { View, Text, Avatar, Button } from 'react-native-ui-lib';
import Ionicons from '@expo/vector-icons/Ionicons';
import { fetchNotifications } from '../../services/mastodon/notifications';
import { Notification } from '../../services/mastodon/types';
import { TootCard } from '../../components/TootCard/tootCard';
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
        if (item.type === 'mention' && item.status) {
            return <TootCard status={item.status} onPress={() => onStatusPress?.(item.status!.id)} />;
        }

        if (item.type === 'follow') {
            return (
                <View style={[styles.followCard, { borderBottomColor: colors.borderColor }]}>
                    <View style={styles.followInfo}>
                        <Avatar source={{ uri: item.account.avatar }} size={48} containerStyle={styles.avatar} />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.followName, { color: colors.textPrimary }]} numberOfLines={1}>
                                {item.account.display_name || item.account.username}
                            </Text>
                            <Text style={[styles.followAcct, { color: colors.textSecondary }]} numberOfLines={1}>
                                @{item.account.acct}
                            </Text>
                        </View>
                    </View>
                    <Button
                        label="Follow back"
                        size={Button.sizes.small}
                        backgroundColor={colors.accentColor}
                        style={styles.followButton}
                        onPress={() => console.log('Follow back pressed')}
                    />
                </View>
            );
        }

        let iconName = '';
        let iconColor = '';
        let actionText = '';

        if (item.type === 'favourite') {
            iconName = 'star';
            iconColor = '#EAB308'; // yellow
            actionText = 'favourited your status';
        } else if (item.type === 'reblog') {
            iconName = 'repeat';
            iconColor = '#22C55E'; // green
            actionText = 'boosted your status';
        } else {
            return null; // Skip unsupported types
        }

        return (
            <TouchableOpacity 
                style={[styles.notificationCard, { borderBottomColor: colors.borderColor }]} 
                onPress={() => item.status && onStatusPress?.(item.status.id)}
                activeOpacity={0.8}
            >
                <View style={styles.iconContainer}>
                    <Ionicons name={iconName as any} size={28} color={iconColor} />
                </View>
                <View style={styles.contentContainer}>
                    <View style={styles.headerRow}>
                        <Avatar source={{ uri: item.account.avatar }} size={32} containerStyle={styles.avatar} />
                        <Text style={[styles.actionText, { color: colors.textPrimary }]}>
                            <Text style={{ fontWeight: 'bold' }}>{item.account.display_name || item.account.username}</Text> {actionText}
                        </Text>
                    </View>
                    {item.status && (
                        <Text 
                            style={[styles.statusPreview, { color: colors.textSecondary }]} 
                            numberOfLines={3}
                        >
                            {stripHtml(item.status.content)}
                        </Text>
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
            <FlatList
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
