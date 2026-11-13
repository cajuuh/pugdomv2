import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useTheme } from '../../services/themeContext';
import { useI18n } from '../../services/i18n/i18nContext';
import { NotificationRequest } from '../../services/mastodon/notificationRequests';
import { plainText } from '../../services/htmlText';
import { radii, space } from '../../services/theme/shape';
import { TAB_BAR_CLEARANCE } from '../../components/TabBar/styles';
import { AccountRow } from '../../components/AccountRow/accountRow';
import { Card, IconButton, PillButton } from '../../components/ui';
import { useNotificationRequests, useRequestActions } from '../../hooks/useNotificationRequests';

interface NotificationRequestsProps {
    onBack: () => void;
    onOpenRequest: (request: NotificationRequest) => void;
    onRules: () => void;
}

// One card per account whose notifications the server held back: what they sent last, and Accept / Dismiss
// onDone: after a successful accept or dismiss (the request's own screen closes)
export const RequestCard = ({ request, onOpen, onDone }: { request: NotificationRequest; onOpen?: () => void; onDone?: () => void }) => {
    const { colors, type } = useTheme();
    const { t, tn } = useI18n();
    const { accept, dismiss } = useRequestActions();
    const count = Number(request.notifications_count) || 0;
    const snippet = plainText(request.last_status?.spoiler_text || request.last_status?.content);
    return (
        <Card style={styles.card}>
            <AccountRow account={request.account} detail={tn('filteredNotifications.count', count)} action={<View />} />
            {!!onOpen && (
                <Pressable
                    onPress={onOpen}
                    accessibilityRole="button"
                    accessibilityLabel={`${tn('filteredNotifications.count', count)}${snippet ? `: ${snippet}` : ''}`}
                    style={({ pressed }) => [styles.snippet, { backgroundColor: colors.inputBackground }, pressed && { opacity: 0.7 }]}
                >
                    <Text style={[type.body, { color: colors.textSecondary }]} numberOfLines={3}>
                        {snippet || tn('filteredNotifications.count', count)}
                    </Text>
                </Pressable>
            )}
            <View style={styles.actions}>
                <PillButton label={t('filteredNotifications.dismiss')} icon="close" size="small" variant="subtle" onPress={async () => (await dismiss(request)) && onDone?.()} />
                <PillButton label={t('filteredNotifications.accept')} icon="checkmark" size="small" onPress={async () => (await accept(request)) && onDone?.()} />
            </View>
        </Card>
    );
};

// Filtered notifications: the accounts the notification policy held back (Mastodon 4.3+)
const NotificationRequests = ({ onBack, onOpenRequest, onRules }: NotificationRequestsProps) => {
    const { colors, type } = useTheme();
    const { t } = useI18n();
    const insets = useSafeAreaInsets();
    const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useNotificationRequests();
    const requests = data?.pages.flatMap(page => page.requests) ?? [];

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.borderColor, backgroundColor: colors.cardBackground }]}>
                <IconButton icon="arrow-back" accessibilityLabel={t('common.goBack')} onPress={onBack} />
                <Text accessibilityRole="header" style={[type.name, styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                    {t('filteredNotifications.title')}
                </Text>
                <PillButton label={t('filteredNotifications.rules')} icon="options-outline" size="small" variant="ghost" onPress={onRules} />
            </View>

            {isLoading ? (
                <ActivityIndicator style={styles.loading} color={colors.accentColor} />
            ) : (
                <FlashList
                    data={requests}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.list}
                    onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
                    onEndReachedThreshold={0.5}
                    ListHeaderComponent={requests.length ? <Text style={[type.meta, styles.intro, { color: colors.textMuted }]}>{t('filteredNotifications.intro')}</Text> : null}
                    ListEmptyComponent={<Text style={[type.body, styles.empty, { color: colors.textMuted }]}>{t('filteredNotifications.empty')}</Text>}
                    ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={colors.accentColor} /> : null}
                    renderItem={({ item }) => <RequestCard request={item} onOpen={() => onOpenRequest(item)} />}
                />
            )}
        </View>
    );
};

export const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        paddingBottom: space.sm,
        paddingHorizontal: space.lg,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    title: {
        flex: 1,
        textAlign: 'center',
    },
    loading: {
        marginTop: space.xl,
    },
    list: {
        paddingTop: space.md,
        paddingBottom: TAB_BAR_CLEARANCE,
    },
    intro: {
        marginHorizontal: space.lg,
        marginBottom: space.md,
    },
    card: {
        marginHorizontal: space.lg,
        marginBottom: space.md,
        paddingBottom: space.md,
    },
    snippet: {
        marginHorizontal: space.lg,
        padding: space.md,
        borderRadius: radii.input,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: space.sm,
        marginTop: space.md,
        marginHorizontal: space.lg,
    },
    empty: {
        textAlign: 'center',
        marginTop: space.xl,
        marginHorizontal: space.lg,
    },
});

export default NotificationRequests;
