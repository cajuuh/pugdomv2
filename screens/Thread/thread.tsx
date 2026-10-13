import React, { useCallback, useEffect, useState } from 'react';

import {
    ActivityIndicator,
    DeviceEventEmitter,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton, SegmentOption, SegmentedPill } from '../../components/ui';
import { getSetting, saveSetting } from '../../services/storage';
import { space } from '../../services/theme/shape';
import { TAB_BAR_CLEARANCE } from '../../components/TabBar/styles';
import { getStatus, getStatusContext } from '../../services/mastodon/statuses';
import { Status } from '../../services/mastodon/types';
import { TootCard } from '../../components/TootCard/tootCard';
import { useTheme } from '../../services/themeContext';
import { useI18n } from '../../services/i18n/i18nContext';
import { renderTextWithEmojis } from '../../services/emojiHelper';
import { STATUS_DELETED_EVENT, STATUS_UPDATED_EVENT } from '../../hooks/useUpdateCachedStatus';

interface ThreadProps {
    statusId: string;
    onBack: () => void;
    onStatusPress: (id: string) => void;
}

type ThreadStatus = Status & {
    isMain?: boolean;
};

type Order = 'oldest' | 'newest';

// Remembered for every thread: long conversations are easier to answer with the newest on top
export const THREAD_NEWEST_FIRST_KEY = 'pugdom_settings_thread_newest_first';

export default function Thread({
    statusId,
    onBack,
    onStatusPress,
}: ThreadProps) {
    const { colors, type } = useTheme();
    const insets = useSafeAreaInsets();
    const { t } = useI18n();

    const [statuses, setStatuses] = useState<ThreadStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [order, setOrder] = useState<Order>('oldest');
    const orders: SegmentOption<Order>[] = [
        { value: 'oldest', label: t('thread.oldestFirst') },
        { value: 'newest', label: t('thread.newestFirst') },
    ];
    const shown = order === 'newest' ? [...statuses].reverse() : statuses;

    useEffect(() => {
        getSetting(THREAD_NEWEST_FIRST_KEY, false).then(newest => setOrder(newest ? 'newest' : 'oldest'));
    }, []);

    const changeOrder = (value: Order) => {
        setOrder(value);
        saveSetting(THREAD_NEWEST_FIRST_KEY, value === 'newest');
    };
    // The post this thread is about (for a boost, the original's author)
    const mainAccount = statuses.find(status => status.isMain)?.account;

    const loadThread = async () => {
        try {
            const [status, context] = await Promise.all([
                getStatus(statusId),
                getStatusContext(statusId),
            ]);

            // Mark the focused post so it can receive the accent treatment.
            const mainStatus: ThreadStatus = {
                ...status,
                isMain: true,
            };

            setStatuses([
                ...context.ancestors,
                mainStatus,
                ...context.descendants,
            ]);
        } catch (error) {
            console.error('Failed to load thread:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        setLoading(true);
        loadThread();
    }, [statusId]);

    // Your edits and deletes show here too; deleting the post the thread is about leaves it
    useEffect(() => {
        const updated = DeviceEventEmitter.addListener(STATUS_UPDATED_EVENT, (status: Status) =>
            setStatuses(current => current.map(item => (item.id === status.id ? { ...status, isMain: item.isMain } : item)))
        );
        const deleted = DeviceEventEmitter.addListener(STATUS_DELETED_EVENT, (id: string) => {
            if (id === statusId) {
                onBack();
                return;
            }
            setStatuses(current => current.filter(item => item.id !== id));
        });
        return () => {
            updated.remove();
            deleted.remove();
        };
    }, [statusId, onBack]);

    const handleRefresh = useCallback(() => {
        setRefreshing(true);
        loadThread();
    }, [statusId]);

    return (
        <View
            style={[
                styles.container,
                {
                    backgroundColor: colors.background,
                },
            ]}
        >
            <View
                testID="thread-header"
                style={[
                    styles.header,
                    {
                        paddingTop: insets.top +10,
                        borderBottomColor: colors.borderColor,
                        backgroundColor: colors.cardBackground,
                    },
                ]}
            >
                <IconButton
                    icon="arrow-back"
                    accessibilityLabel={t('common.goBack')}
                    onPress={onBack}
                />

                {/* Which post this is: "Publicação de Ana" and the author's handle */}
                <View style={styles.headerTitle} accessible accessibilityRole="header">
                    <Text style={[type.name, { color: colors.textPrimary }]} numberOfLines={1}>
                        {mainAccount
                            ? renderTextWithEmojis(
                                  t('thread.titleBy', { name: mainAccount.display_name || mainAccount.username }),
                                  mainAccount.emojis || [],
                                  [type.name, { color: colors.textPrimary }],
                                  15
                              )
                            : t('thread.title')}
                    </Text>
                    {mainAccount && (
                        <Text style={[type.meta, { color: colors.textMuted }]} numberOfLines={1}>
                            @{mainAccount.acct}
                        </Text>
                    )}
                </View>

                <View style={styles.headerSpacer} />
            </View>

            {!loading && statuses.length > 1 && (
                <View style={styles.order}>
                    <SegmentedPill variant="chips" options={orders} value={order} onChange={changeOrder} />
                </View>
            )}

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator
                        size="large"
                        color={colors.accentColor}
                    />
                </View>
            ) : (
                <FlashList
                    // A fresh list per order, starting from the top
                    key={order}
                    data={shown}
                   keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item, index }) => {
                        const isMain = item.isMain;

                        return (
                            <View
                                style={[
                                    styles.postContainer,
                                    {
                                        borderBottomColor:
                                            colors.borderColor,
                                    },
                                    isMain && {
                                        backgroundColor:
                                            colors.cardBackground,
                                        borderLeftColor:
                                            colors.accentSoft,
                                        borderLeftWidth:
                                            StyleSheet.hairlineWidth,
                                    },
                                ]}
                            >
                                <TootCard
                                    status={item}
                                    onPress={onStatusPress}
                                    threadMode={true}
                                    showReactions={isMain}
                                    hasThreadLineTop={index > 0}
                                    hasThreadLineBottom={
                                        index < shown.length - 1
                                    }
                                />
                            </View>
                        );
                    }}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            tintColor={colors.accentColor}
                        />
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: space.sm,
        paddingHorizontal: space.lg,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },

    headerTitle: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: space.sm,
    },

    headerSpacer: {
        width: 44,
    },

    order: {
        paddingTop: space.md,
        paddingBottom: space.sm,
        paddingHorizontal: space.lg,
    },

    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },

    listContent: {
        paddingBottom: TAB_BAR_CLEARANCE,
    },

    postContainer: {
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
});