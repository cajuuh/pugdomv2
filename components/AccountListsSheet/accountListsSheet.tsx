import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BottomSheet } from '../ComposeModal/optionSheet';
import { useAccountLists, useListActions, useLists } from '../../hooks/useLists';
import { Account } from '../../services/mastodon/types';
import { useI18n } from '../../services/i18n/i18nContext';
import { useTheme } from '../../services/themeContext';
import { radii, space } from '../../services/theme/shape';
import { PillButton } from '../ui';
import { dialog } from '../../services/dialog';

interface AccountListsSheetProps {
    visible: boolean;
    onClose: () => void;
    account: Account;
    // Mastodon lists only hold people you follow
    following: boolean;
}

// Your lists, with a check on the ones this person is in; tapping adds or removes them.
// New list makes one right here (default settings; the list editor has the rest) with this person in it.
export const AccountListsSheet: React.FC<AccountListsSheetProps> = ({ visible, onClose, account, following }) => {
    const { colors, type } = useTheme();
    const { t } = useI18n();
    const name = account.display_name || account.username;
    const { data: lists, isLoading } = useLists(visible);
    const { data: memberOf } = useAccountLists(account.id, visible && following);
    const { addMember, removeMember, create } = useListActions();
    const [pending, setPending] = useState<string | null>(null);
    // The new list's name while it's being typed; null while the field is closed
    const [newTitle, setNewTitle] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);

    const createWithMember = async () => {
        const title = newTitle?.trim();
        if (!title) return;
        setCreating(true);
        try {
            const list = await create({ title });
            await addMember(list.id, account.id);
            setNewTitle(null);
            dialog.toast(t('lists.createdWith', { name, list: title }));
        } catch {
            dialog.toast(t('lists.failed'));
        } finally {
            setCreating(false);
        }
    };

    const newList = following && (
        newTitle === null ? (
            <Pressable onPress={() => setNewTitle('')} accessibilityRole="button" accessibilityLabel={t('lists.newList')} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
                <Ionicons name="add-circle-outline" size={20} color={colors.accentText} />
                <Text style={[type.name, styles.title, { color: colors.accentText }]}>{t('lists.newList')}</Text>
            </Pressable>
        ) : (
            <View style={styles.newList}>
                <TextInput
                    value={newTitle}
                    onChangeText={setNewTitle}
                    autoFocus
                    placeholder={t('lists.namePlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    accessibilityLabel={t('lists.name')}
                    returnKeyType="done"
                    onSubmitEditing={createWithMember}
                    style={[type.body, styles.input, { color: colors.textPrimary, backgroundColor: colors.inputBackground }]}
                />
                <View style={styles.newListButtons}>
                    <PillButton label={t('lists.createAndAdd')} icon="add" onPress={createWithMember} loading={creating} disabled={!newTitle.trim()} />
                    <PillButton label={t('common.cancel')} variant="ghost" onPress={() => setNewTitle(null)} />
                </View>
            </View>
        )
    );

    const toggle = async (listId: string, inList: boolean) => {
        setPending(listId);
        try {
            await (inList ? removeMember(listId, account.id) : addMember(listId, account.id));
        } catch {
            dialog.toast(t('lists.failed'));
        } finally {
            setPending(null);
        }
    };

    const content = () => {
        if (!following) return <Text style={[type.body, styles.note, { color: colors.textMuted }]}>{t('lists.followFirst', { name })}</Text>;
        if (isLoading) return <ActivityIndicator color={colors.accentColor} style={styles.note} />;
        if (!lists?.length) return <Text style={[type.body, styles.note, { color: colors.textMuted }]}>{t('lists.none')}</Text>;
        return lists.map(list => {
            const inList = !!memberOf?.some(member => member.id === list.id);
            return (
                <Pressable
                    key={list.id}
                    onPress={() => toggle(list.id, inList)}
                    disabled={pending !== null}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: inList, busy: pending === list.id }}
                    accessibilityLabel={list.title}
                    style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
                >
                    <Ionicons name="list-outline" size={20} color={colors.accentText} />
                    <Text style={[type.name, styles.title, { color: colors.textPrimary }]} numberOfLines={1}>{list.title}</Text>
                    {pending === list.id ? (
                        <ActivityIndicator size="small" color={colors.accentColor} />
                    ) : (
                        <Ionicons name={inList ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={inList ? colors.accentText : colors.textMuted} />
                    )}
                </Pressable>
            );
        });
    };

    return (
        <BottomSheet visible={visible} title={t('lists.addToListsTitle')} subtitle={name} onClose={onClose}>
            <ScrollView>
                <View style={styles.list}>
                    {content()}
                    {newList}
                </View>
            </ScrollView>
        </BottomSheet>
    );
};

const styles = StyleSheet.create({
    list: {
        paddingBottom: space.md,
    },
    row: {
        minHeight: 52,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingHorizontal: space.xs,
    },
    title: {
        flex: 1,
    },
    newList: {
        gap: space.sm,
        paddingTop: space.sm,
        paddingHorizontal: space.xs,
    },
    input: {
        minHeight: 48,
        paddingHorizontal: space.md,
        borderRadius: radii.input,
    },
    newListButtons: {
        flexDirection: 'row',
        gap: space.sm,
    },
    note: {
        paddingVertical: space.lg,
        paddingHorizontal: space.xs,
    },
});
