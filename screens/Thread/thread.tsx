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
import { threadCardMetrics } from '../../components/TootCard/styles';
import { useSettings } from '../../services/settingsContext';
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

export interface ThreadRow {
    status: ThreadStatus;
    // 0: the post and what it answers; 1: an answer to the post; 2: anything further down that answer's branch
    depth: 0 | 1 | 2;
    // For depth 2 rows that answer someone other than the branch's first reply
    replyingTo?: Status['account'];
}

// Oldest first: ancestors and the post, then each answer to the post with its whole branch under it, one indent in
// and in reading order. Replies whose parent is missing count as answers to the post.
export function threadRows(statuses: ThreadStatus[], newestFirst: boolean): ThreadRow[] {
    const mainIndex = statuses.findIndex(status => status.isMain);
    if (mainIndex < 0) return statuses.map(status => ({ status, depth: 0 }));
    const main = statuses[mainIndex];
    const byId = new Map(statuses.map(status => [status.id, status]));
    const children = new Map<string, ThreadStatus[]>();
    statuses.slice(mainIndex + 1).forEach(reply => {
        const parent = reply.in_reply_to_id && byId.has(reply.in_reply_to_id) ? reply.in_reply_to_id : main.id;
        children.set(parent, [...(children.get(parent) ?? []), reply]);
    });
    const answersTo = (id: string) => [...(children.get(id) ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));

    const chain: ThreadRow[] = statuses.slice(0, mainIndex + 1).map(status => ({ status, depth: 0 }));
    const branches = answersTo(main.id).map(head => {
        const rows: ThreadRow[] = [{ status: head, depth: 1 }];
        const branch = (id: string) =>
            answersTo(id).forEach(reply => {
                const parent = byId.get(reply.in_reply_to_id ?? '');
                rows.push({ status: reply, depth: 2, replyingTo: parent && parent.id !== head.id ? parent.account : undefined });
                branch(reply.id);
            });
        branch(head.id);
        return rows;
    });
    // Newest first turns the whole thread over (a direct message opens on its latest post, everything above it),
    // keeping each branch in reading order under its first reply
    return newestFirst ? [...branches.reverse().flat(), ...chain.reverse()] : [...chain, ...branches.flat()];
}

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
    const shown = threadRows(statuses, order === 'newest');
    // A branch hangs one indent in, its line running down from the first reply's avatar
    const { compactMode } = useSettings();
    const card = threadCardMetrics(compactMode);
    const indent = card.padding + card.avatarSize / 2;
    const railLeft = indent - 1;
    const elbowY = card.paddingTop + card.avatarSize / 2 - 1;

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
                    keyExtractor={(row) => row.status.id}
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item: { status: item, depth, replyingTo }, index }) => {
                        const isMain = item.isMain;
                        const nextDepth = shown[index + 1]?.depth;
                        // A branch ends at the next answer to the post; only then a hairline
                        const inBranch = nextDepth === 2;

                        return (
                            <View style={depth === 2 && { paddingLeft: indent }}>
                                {depth === 2 && (
                                    <>
                                        {/* Curves from the branch's line into this reply's avatar; carries on if more follow */}
                                        <View
                                            testID="thread-branch"
                                            style={[styles.branchCurve, { left: railLeft, width: indent + card.padding - railLeft - space.xs, height: elbowY + 2, borderColor: colors.borderColor }]}
                                        />
                                        {inBranch && <View style={[styles.branchRail, { left: railLeft, top: elbowY, backgroundColor: colors.borderColor }]} />}
                                    </>
                                )}
                                <View
                                    style={[
                                        !(depth > 0 && inBranch) && styles.postContainer,
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
                                        // The avatar line links what the post answers down to it, and a reply to its branch
                                        hasThreadLineTop={depth === 0 && shown[index - 1]?.depth === 0}
                                        hasThreadLineBottom={(depth === 0 && nextDepth === 0) || (depth === 1 && inBranch)}
                                        indent={depth === 2 ? indent : 0}
                                        replyingTo={replyingTo && `@${replyingTo.username}`}
                                    />
                                </View>
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

    branchCurve: {
        position: 'absolute',
        top: 0,
        borderLeftWidth: 2,
        borderBottomWidth: 2,
        borderBottomLeftRadius: space.md,
    },

    branchRail: {
        position: 'absolute',
        bottom: 0,
        width: 2,
    },

    postContainer: {
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
});