import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useTheme } from '../../services/themeContext';
import { useI18n } from '../../services/i18n/i18nContext';
import { useOptionalAuth } from '../../services/authContext';
import { Collection as CollectionType } from '../../services/mastodon/types';
import { featuredAccounts, itemFor } from '../../services/mastodon/collections';
import { plainText } from '../../services/htmlText';
import { useCollection, useCollectionActions } from '../../hooks/useCollections';
import { useNavigator } from '../../services/navigationContext';
import { useRelationships } from '../../hooks/useRelationships';
import { useOpenAccount } from '../../hooks/useOpenAccount';
import { dialog } from '../../services/dialog';
import { radii, space } from '../../services/theme/shape';
import { TAB_BAR_CLEARANCE } from '../../components/TabBar/styles';
import { AccountRow } from '../../components/AccountRow/accountRow';
import { Avatar, IconButton, PillButton } from '../../components/ui';
import { Icon } from '../../components/ui/icon';

interface CollectionProps {
    collectionId: string;
    // The copy from the profile, for the title while the people load
    collection?: CollectionType;
    onBack: () => void;
}

// A collection (Mastodon 4.6): who made it, what it's about, and its people, each with a follow button.
// Yours can be edited and its people taken out; if you're in someone else's, you can leave it.
const Collection = ({ collectionId, collection: initial, onBack }: CollectionProps) => {
    const { colors, type } = useTheme();
    const { t, tn } = useI18n();
    const insets = useSafeAreaInsets();
    const me = useOptionalAuth()?.user;
    const { openAccount, openHashtag } = useOpenAccount();
    const { data, isLoading, isError } = useCollection(collectionId);
    const collection = data?.collection ?? initial;
    const curator = data?.accounts.find(account => account.id === collection?.account_id);
    const people = data && collection ? featuredAccounts(collection, data.accounts, me?.id) : [];
    const relationships = useRelationships(people.filter(({ account }) => account.id !== me?.id).map(({ account }) => account.id));
    const description = plainText(collection?.description ?? '').trim();
    const { push } = useNavigator();
    const actions = useCollectionActions();
    const isOwner = !!me && collection?.account_id === me.id;
    // You, in someone else's collection
    const myItem = !isOwner && me && collection ? itemFor(collection, me.id) : undefined;
    const [busyItem, setBusyItem] = useState<string | null>(null);

    const run = async (itemId: string, task: () => Promise<unknown>) => {
        setBusyItem(itemId);
        try {
            await task();
        } catch {
            dialog.toast(t('collections.failed'));
        } finally {
            setBusyItem(null);
        }
    };

    const confirmLeave = () =>
        dialog.alert(t('collections.leaveTitle', { name: collection!.name }), t('collections.leaveMessage'), [
            { text: t('collections.keep'), style: 'cancel' },
            { text: t('collections.leave'), style: 'destructive', onPress: () => run(myItem!.id, () => actions.leave(collectionId, myItem!.id)) },
        ]);

    const share = async () => {
        if (!collection?.url) return;
        try {
            await Share.share({ message: collection.url });
        } catch (error: any) {
            dialog.alert(t('profile.shareFailed'), error.message);
        }
    };

    const info = collection && (
        <View style={styles.info}>
            <Text accessibilityRole="header" style={[type.title, { color: colors.textPrimary }]}>
                {collection.name}
            </Text>
            {curator && (
                <Pressable
                    onPress={() => openAccount(curator)}
                    accessibilityRole="link"
                    accessibilityLabel={t('collections.by', { name: curator.display_name || curator.username })}
                    style={({ pressed }) => [styles.curator, pressed && { opacity: 0.7 }]}
                >
                    <Avatar name={curator.display_name || curator.username} uri={curator.avatar} staticUri={curator.avatar_static} size={24} />
                    <Text style={[type.meta, { color: colors.textMuted }]} numberOfLines={1}>
                        {t('collections.by', { name: curator.display_name || curator.username })}
                    </Text>
                </Pressable>
            )}
            {!!description && <Text style={[type.body, { color: colors.textPrimary }]}>{description}</Text>}
            <View style={styles.chips}>
                <View style={[styles.chip, { backgroundColor: colors.inputBackground }]}>
                    <Icon name="layers-outline" size={14} color={colors.textMuted} />
                    <Text style={[type.meta, { color: colors.textMuted }]}>{tn('collections.accounts', collection.item_count)}</Text>
                </View>
                {!!collection.tag && (
                    <Pressable
                        onPress={() => openHashtag(collection.tag!.name)}
                        accessibilityRole="link"
                        style={({ pressed }) => [styles.chip, { backgroundColor: colors.accentSoft }, pressed && { opacity: 0.7 }]}
                    >
                        <Icon name="pricetag-outline" size={14} color={colors.accentText} />
                        <Text style={[type.meta, { color: colors.accentText }]}>#{collection.tag.name}</Text>
                    </Pressable>
                )}
                {collection.sensitive && (
                    <View style={[styles.chip, { backgroundColor: colors.inputBackground }]}>
                        <Icon name="warning-outline" size={14} color={colors.textMuted} />
                        <Text style={[type.meta, { color: colors.textMuted }]}>{t('collections.sensitive')}</Text>
                    </View>
                )}
                {!collection.discoverable && (
                    <View style={[styles.chip, { backgroundColor: colors.inputBackground }]}>
                        <Icon name="lock-closed-outline" size={14} color={colors.textMuted} />
                        <Text style={[type.meta, { color: colors.textMuted }]}>{t('collections.unlisted')}</Text>
                    </View>
                )}
            </View>
            {isOwner && (
                <PillButton
                    label={t('collections.edit')}
                    icon="create-outline"
                    variant="ghost"
                    onPress={() => push({ name: 'collectionEditor', collectionId })}
                    style={styles.action}
                />
            )}
            {!!myItem && (
                <PillButton
                    label={t('collections.leave')}
                    icon="log-out-outline"
                    variant="ghost"
                    onPress={confirmLeave}
                    loading={busyItem === myItem.id}
                    style={styles.action}
                />
            )}
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.borderColor, backgroundColor: colors.cardBackground }]}>
                <IconButton icon="arrow-back" accessibilityLabel={t('common.goBack')} onPress={onBack} />
                <Text accessibilityRole="header" style={[type.name, styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                    {t('collections.one')}
                </Text>
                {collection?.url ? (
                    <IconButton icon="share-outline" accessibilityLabel={t('collections.share')} onPress={share} />
                ) : (
                    <View style={styles.spacer} />
                )}
            </View>

            {isLoading && !collection ? (
                <ActivityIndicator style={styles.loading} color={colors.accentColor} />
            ) : (
                <FlashList
                    data={people}
                    extraData={relationships}
                    keyExtractor={({ item }) => item.id}
                    renderItem={({ item: { item, account } }) => (
                        <AccountRow
                            account={account}
                            relationship={relationships.get(account.id)}
                            isSelf={account.id === me?.id}
                            // Only you see these: people who haven't agreed to be featured yet
                            detail={item.state === 'pending' ? t('collections.pending') : undefined}
                            // In yours, a person can be taken out instead of followed
                            action={
                                isOwner ? (
                                    <PillButton
                                        label={t('collections.remove')}
                                        icon="remove-circle-outline"
                                        variant="ghost"
                                        accessibilityLabel={t('collections.removeLabel', { name: account.display_name || account.username })}
                                        loading={busyItem === item.id}
                                        onPress={() => run(item.id, () => actions.removeItem(collectionId, item.id))}
                                    />
                                ) : undefined
                            }
                        />
                    )}
                    ListHeaderComponent={info}
                    ListEmptyComponent={
                        isLoading ? (
                            <ActivityIndicator style={styles.loading} color={colors.accentColor} />
                        ) : (
                            <Text style={[type.body, styles.empty, { color: colors.textMuted }]}>
                                {t(isError ? 'collections.loadFailed' : isOwner ? 'collections.emptyOwner' : 'collections.empty')}
                            </Text>
                        )
                    }
                    contentContainerStyle={styles.list}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingBottom: space.sm,
        paddingHorizontal: space.lg,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    title: {
        flex: 1,
        textAlign: 'center',
    },
    spacer: {
        width: 44,
    },
    loading: {
        marginTop: space.xl,
    },
    info: {
        gap: space.md,
        paddingHorizontal: space.lg,
        paddingTop: space.lg,
        paddingBottom: space.md,
    },
    curator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        alignSelf: 'flex-start',
    },
    chips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: space.sm,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        paddingHorizontal: space.md,
        paddingVertical: space.xs + 2,
        borderRadius: radii.pill,
    },
    list: {
        paddingBottom: TAB_BAR_CLEARANCE,
    },
    action: {
        alignSelf: 'flex-start',
    },
    empty: {
        textAlign: 'center',
        marginTop: space.xl,
        paddingHorizontal: space.xl,
    },
});

export default Collection;
