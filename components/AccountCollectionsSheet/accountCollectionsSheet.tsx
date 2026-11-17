import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Icon } from '../ui/icon';
import { BottomSheet } from '../ComposeModal/optionSheet';
import { useAccountCollections, useCollectionActions } from '../../hooks/useCollections';
import { COLLECTION_MAX_ACCOUNTS, COLLECTION_NAME_MAX, canFeature, itemFor } from '../../services/mastodon/collections';
import { Account } from '../../services/mastodon/types';
import { useOptionalAuth } from '../../services/authContext';
import { useI18n } from '../../services/i18n/i18nContext';
import { useTheme } from '../../services/themeContext';
import { radii, space } from '../../services/theme/shape';
import { PillButton } from '../ui';
import { dialog } from '../../services/dialog';

interface AccountCollectionsSheetProps {
    visible: boolean;
    onClose: () => void;
    account: Account;
}

// Your collections, with a check on the ones this person is in; tapping adds or takes them out. New collection
// makes one right here with them in it. People who don't allow being featured (or whose server has no
// collections) get a note saying so instead.
export const AccountCollectionsSheet: React.FC<AccountCollectionsSheetProps> = ({ visible, onClose, account }) => {
    const { colors, type } = useTheme();
    const { t, tn } = useI18n();
    const me = useOptionalAuth()?.user;
    const name = account.display_name || account.username;
    const collections = useAccountCollections(me?.id ?? '');
    const { add, removeItem, create } = useCollectionActions();
    const [pending, setPending] = useState<string | null>(null);
    // The new collection's name while it's being typed; null while the field is closed
    const [newName, setNewName] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const allowed = canFeature(account);

    const createWith = async () => {
        const title = newName?.trim();
        if (!title) return;
        setCreating(true);
        try {
            await create({ name: title, discoverable: true }, [account.id]);
            setNewName(null);
            dialog.toast(t('collections.createdWith', { name, collection: title }));
        } catch {
            dialog.toast(t('collections.failed'));
        } finally {
            setCreating(false);
        }
    };

    const toggle = async (collectionId: string, itemId?: string) => {
        setPending(collectionId);
        try {
            await (itemId ? removeItem(collectionId, itemId) : add(collectionId, account.id));
        } catch {
            dialog.toast(t('collections.failed'));
        } finally {
            setPending(null);
        }
    };

    const note = (text: string) => <Text style={[type.body, styles.note, { color: colors.textMuted }]}>{text}</Text>;

    const content = () => {
        if (!allowed) return note(t(account.feature_approval?.current_user === 'missing' || !account.feature_approval ? 'collections.serverMissing' : 'collections.notAllowed', { name }));
        return (
            <>
                {account.feature_approval?.current_user === 'manual' && note(t('collections.needsApproval', { name }))}
                {!collections.length && note(t('collections.noneYours'))}
                {collections.map(collection => {
                    const item = itemFor(collection, account.id);
                    // A full collection can still take them out, not in
                    const full = !item && collection.item_count >= COLLECTION_MAX_ACCOUNTS;
                    return (
                        <Pressable
                            key={collection.id}
                            onPress={() => toggle(collection.id, item?.id)}
                            disabled={pending !== null || full}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: !!item, busy: pending === collection.id, disabled: full }}
                            accessibilityLabel={collection.name}
                            style={({ pressed }) => [styles.row, (pressed || full) && { opacity: 0.6 }]}
                        >
                            <Icon name="layers-outline" size={20} color={colors.accentText} />
                            <View style={styles.title}>
                                <Text style={[type.name, { color: colors.textPrimary }]} numberOfLines={1}>{collection.name}</Text>
                                <Text style={[type.meta, { color: colors.textMuted }]}>
                                    {full ? t('collections.full') : tn('collections.accounts', collection.item_count)}
                                </Text>
                            </View>
                            {pending === collection.id ? (
                                <ActivityIndicator size="small" color={colors.accentColor} />
                            ) : (
                                <Icon name={item ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={item ? colors.accentText : colors.textMuted} />
                            )}
                        </Pressable>
                    );
                })}
                {newName === null ? (
                    <Pressable onPress={() => setNewName('')} accessibilityRole="button" accessibilityLabel={t('collections.new')} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
                        <Icon name="add-circle-outline" size={20} color={colors.accentText} />
                        <Text style={[type.name, styles.title, { color: colors.accentText }]}>{t('collections.new')}</Text>
                    </Pressable>
                ) : (
                    <View style={styles.newCollection}>
                        <TextInput
                            value={newName}
                            onChangeText={setNewName}
                            autoFocus
                            maxLength={COLLECTION_NAME_MAX}
                            placeholder={t('collections.namePlaceholder')}
                            placeholderTextColor={colors.textMuted}
                            accessibilityLabel={t('collections.name')}
                            returnKeyType="done"
                            onSubmitEditing={createWith}
                            style={[type.body, styles.input, { color: colors.textPrimary, backgroundColor: colors.inputBackground }]}
                        />
                        <View style={styles.buttons}>
                            <PillButton label={t('collections.createAndAdd')} icon="add" onPress={createWith} loading={creating} disabled={!newName.trim()} />
                            <PillButton label={t('common.cancel')} variant="ghost" onPress={() => setNewName(null)} />
                        </View>
                    </View>
                )}
            </>
        );
    };

    return (
        <BottomSheet visible={visible} title={t('collections.addTo')} subtitle={name} onClose={onClose}>
            <ScrollView>
                <View style={styles.list}>{content()}</View>
            </ScrollView>
        </BottomSheet>
    );
};

const styles = StyleSheet.create({
    list: {
        paddingBottom: space.md,
    },
    row: {
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingHorizontal: space.xs,
    },
    title: {
        flex: 1,
    },
    newCollection: {
        gap: space.sm,
        paddingTop: space.sm,
        paddingHorizontal: space.xs,
    },
    input: {
        minHeight: 48,
        paddingHorizontal: space.md,
        borderRadius: radii.input,
    },
    buttons: {
        flexDirection: 'row',
        gap: space.sm,
    },
    note: {
        paddingVertical: space.md,
        paddingHorizontal: space.xs,
    },
});
