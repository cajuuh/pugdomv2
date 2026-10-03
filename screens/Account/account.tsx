import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../services/authContext';
import { useTheme } from '../../services/themeContext';
import { Account as AccountType, Status } from '../../services/mastodon/types';
import { ProfileTab, useAccountStatuses } from '../../hooks/useAccountStatuses';
import { useAccount } from '../../hooks/useAccount';
import { useRelationships } from '../../hooks/useRelationships';
import { TootCard } from '../../components/TootCard/tootCard';
import { IconButton, SegmentOption } from '../../components/ui';
import { useThemedStyles } from '../../services/theme/useThemedStyles';
import { useI18n } from '../../services/i18n/i18nContext';
import { ProfileHeader } from '../Profile/profileHeader';
import { makeStyles } from '../Profile/styles';

const TABS: ProfileTab[] = ['posts', 'replies', 'media'];

const EMPTY_TEXT = {
    posts: 'profile.emptyPosts',
    replies: 'profile.emptyReplies',
    media: 'profile.emptyMedia',
} as const;

interface AccountProps {
    accountId: string;
    // A copy from the post or notification it was opened from, shown while the full profile loads
    account?: AccountType;
    onBack: () => void;
    onStatusPress: (id: string) => void;
    onSettingsPress: () => void;
}

// Anyone's profile, opened on top of the tabs. Your own account gets the "self" header (edit, settings).
const Account = ({ accountId, account: initialAccount, onBack, onStatusPress, onSettingsPress }: AccountProps) => {
    const { user } = useAuth();
    const { colors, type } = useTheme();
    const { t } = useI18n();
    const styles = useThemedStyles(makeStyles);
    const insets = useSafeAreaInsets();
    const isSelf = user?.id === accountId;
    const [tab, setTab] = useState<ProfileTab>('posts');
    const tabs: SegmentOption<ProfileTab>[] = TABS.map(value => ({ value, label: t(`profile.${value}`) }));
    const [isPullRefreshing, setIsPullRefreshing] = useState(false);

    const { data: account, isError, refetch: refetchAccount } = useAccount(accountId, initialAccount);
    const relationships = useRelationships(isSelf ? [] : [accountId]);
    const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, refetch } = useAccountStatuses(accountId, tab);
    const statuses = data?.pages.flat() ?? [];

    const handleRefresh = useCallback(async () => {
        setIsPullRefreshing(true);
        try {
            await Promise.all([refetchAccount(), refetch()]);
        } finally {
            setIsPullRefreshing(false);
        }
    }, [refetchAccount, refetch]);

    if (!account) {
        return (
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <IconButton icon="arrow-back" accessibilityLabel={t('account.back')} onPress={onBack} />
                <View style={styles.empty}>
                    {isError
                        ? <Text style={[type.body, styles.emptyText]}>{t('account.loadFailed')}</Text>
                        : <ActivityIndicator color={colors.accentColor} />}
                </View>
            </View>
        );
    }

    const renderEmpty = () => (
        <View style={styles.empty}>
            {isLoading
                ? <ActivityIndicator color={colors.accentColor} />
                : <Text style={[type.body, styles.emptyText]}>{t(EMPTY_TEXT[tab])}</Text>}
        </View>
    );

    return (
        <View style={styles.container}>
            <FlashList
                data={statuses}
                keyExtractor={(item: Status) => item.id}
                renderItem={({ item }) => <TootCard status={item} onPress={onStatusPress} />}
                ListHeaderComponent={
                    <ProfileHeader
                        user={account}
                        mode={isSelf ? 'self' : 'other'}
                        tabs={tabs}
                        tab={tab}
                        onChangeTab={setTab}
                        onBack={onBack}
                        onSettingsPress={onSettingsPress}
                        relationship={relationships.get(accountId)}
                        topInset={insets.top}
                    />
                }
                ListEmptyComponent={renderEmpty}
                ListFooterComponent={isFetchingNextPage ? <ActivityIndicator style={styles.footer} color={colors.accentColor} /> : null}
                onEndReached={() => {
                    if (!isFetchingNextPage && hasNextPage) fetchNextPage();
                }}
                onEndReachedThreshold={0.5}
                refreshControl={
                    <RefreshControl
                        refreshing={isPullRefreshing}
                        onRefresh={handleRefresh}
                        tintColor={colors.accentColor}
                        colors={[colors.accentColor]}
                    />
                }
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
};

export default Account;
