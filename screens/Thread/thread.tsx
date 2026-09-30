import React, { useCallback, useEffect, useState } from 'react';

import {
    ActivityIndicator,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '../../components/ui';
import { space } from '../../services/theme/shape';
import { getStatus, getStatusContext } from '../../services/mastodon/statuses';
import { Status } from '../../services/mastodon/types';
import { TootCard } from '../../components/TootCard/tootCard';
import { useTheme } from '../../services/themeContext';

interface ThreadProps {
    statusId: string;
    onBack: () => void;
    onStatusPress: (id: string) => void;
}

type ThreadStatus = Status & {
    isMain?: boolean;
};

export default function Thread({
    statusId,
    onBack,
    onStatusPress,
}: ThreadProps) {
    const { colors, type } = useTheme();
    const insets = useSafeAreaInsets();

    const [statuses, setStatuses] = useState<ThreadStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

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
                    accessibilityLabel="Go back"
                    onPress={onBack}
                />

                <Text
                    style={[
                        type.name,
                        {
                            color: colors.textPrimary,
                        },
                    ]}
                >
                    Thread
                </Text>

                <View style={styles.headerSpacer} />
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator
                        size="large"
                        color={colors.accentColor}
                    />
                </View>
            ) : (
                <FlashList
                    data={statuses}
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
                                    hasThreadLineTop={index > 0}
                                    hasThreadLineBottom={
                                        index < statuses.length - 1
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

    headerSpacer: {
        width: 44,
    },

    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },

    listContent: {
        paddingBottom: 100,
    },

    postContainer: {
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
});