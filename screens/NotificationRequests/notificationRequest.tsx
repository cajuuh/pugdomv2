import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTheme } from '../../services/themeContext';
import { useI18n } from '../../services/i18n/i18nContext';
import { getRequestNotifications, NotificationRequest } from '../../services/mastodon/notificationRequests';
import { groupsFromNotifications } from '../../services/mastodon/notifications';
import { Notification } from '../../services/mastodon/types';
import { Card, IconButton } from '../../components/ui';
import { NotificationRow } from '../Notifications/notifications';
import { RequestCard, styles } from './notificationRequests';

interface NotificationRequestProps {
    request: NotificationRequest;
    onBack: () => void;
    onStatusPress: (id: string) => void;
}

// One account's held notifications, as they'd look in Notifications, with Accept / Dismiss on top
const NotificationRequestScreen = ({ request, onBack, onStatusPress }: NotificationRequestProps) => {
    const { colors, type } = useTheme();
    const { t } = useI18n();
    const insets = useSafeAreaInsets();
    const name = request.account.display_name || request.account.username;

    // Not under ['notifications']: the Notifications screen reads every query there as its own pages
    const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
        queryKey: ['notificationRequest', request.account.id],
        queryFn: ({ pageParam }) => getRequestNotifications(request.account.id, pageParam),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (page: Notification[]) => page[page.length - 1]?.id,
    });
    const groups = groupsFromNotifications(data?.pages.flat() ?? [], false);

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.borderColor, backgroundColor: colors.cardBackground }]}>
                <IconButton icon="arrow-back" accessibilityLabel={t('common.goBack')} onPress={onBack} />
                <Text accessibilityRole="header" style={[type.name, styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                    {name}
                </Text>
                <View style={{ width: 44 }} />
            </View>
            <FlashList
                data={groups}
                keyExtractor={item => item.key}
                contentContainerStyle={styles.list}
                onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
                onEndReachedThreshold={0.5}
                ListHeaderComponent={<RequestCard request={request} onDone={onBack} />}
                ListEmptyComponent={isLoading ? <ActivityIndicator style={styles.loading} color={colors.accentColor} /> : null}
                ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={colors.accentColor} /> : null}
                renderItem={({ item }) => (
                    <Card style={styles.card}>
                        <NotificationRow group={item} onStatusPress={onStatusPress} />
                    </Card>
                )}
            />
        </View>
    );
};

export default NotificationRequestScreen;
