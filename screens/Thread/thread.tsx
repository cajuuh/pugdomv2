import React, { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, TouchableOpacity } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { View, Text } from 'react-native-ui-lib';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getStatus, getStatusContext } from '../../services/mastodon/statuses';
import { Status } from '../../services/mastodon/types';
import { TootCard } from '../../components/TootCard/tootCard';
import { useTheme } from '../../services/themeContext';

interface ThreadProps {
    statusId: string;
    onBack: () => void;
    onStatusPress: (id: string) => void;
}

export default function Thread({ statusId, onBack, onStatusPress }: ThreadProps) {
    const { colors } = useTheme();
    const [statuses, setStatuses] = useState<Status[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadThread = async () => {
        try {
            const [status, context] = await Promise.all([
                getStatus(statusId),
                getStatusContext(statusId)
            ]);
            
            // We attach a temporary field so we can highlight it
            const mainStatus = { ...status, isMain: true }; 
            
            setStatuses([...context.ancestors, mainStatus as Status, ...context.descendants]);
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
        <View flex style={{ backgroundColor: colors.background }}>
            <View style={[styles.header, { borderBottomColor: colors.borderColor, backgroundColor: colors.cardBackground }]}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Thread</Text>
                <View style={{ width: 40 }} />
            </View>
            
            {loading ? (
                <View flex center>
                    <ActivityIndicator size="large" color={colors.accentColor} />
                </View>
            ) : (
                <FlashList
                    data={statuses}
                    keyExtractor={(item, index) => item.id + index}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    renderItem={({ item, index }) => {
                        const isMain = (item as any).isMain;
                        return (
                            <View style={[
                                { borderBottomWidth: 1, borderBottomColor: colors.borderColor },
                                isMain && { backgroundColor: colors.cardBackground }
                            ]}>
                                 <TootCard 
                                    status={item} 
                                    onPress={() => onStatusPress(item.id)} 
                                    threadMode={true} 
                                    hasThreadLineTop={index > 0} 
                                    hasThreadLineBottom={index < statuses.length - 1}
                                />
                            </View>
                        );
                    }}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accentColor} />
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 50,
        paddingBottom: 10,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
    },
    backButton: {
        padding: 8,
        marginLeft: -8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    }
});
