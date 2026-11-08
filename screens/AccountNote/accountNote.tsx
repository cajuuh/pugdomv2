import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../services/themeContext';
import { useI18n } from '../../services/i18n/i18nContext';
import { useSetNote } from '../../hooks/useRelationships';
import { NOTE_LIMIT } from '../../services/mastodon/accounts';
import { Account } from '../../services/mastodon/types';
import { radii, space } from '../../services/theme/shape';
import { IconButton, PillButton } from '../../components/ui';
import { dialog } from '../../services/dialog';

interface AccountNoteProps {
    account: Account;
    note: string;
    onBack: () => void;
}

// Your private note on someone (Mastodon's personal note): a screen of its own, the field at the top, so
// the keyboard never covers it. Saving it empty removes it.
const AccountNote = ({ account, note, onBack }: AccountNoteProps) => {
    const { colors, type } = useTheme();
    const { t } = useI18n();
    const insets = useSafeAreaInsets();
    const setNote = useSetNote();
    const [text, setText] = useState(note);
    const [busy, setBusy] = useState(false);

    const save = async () => {
        setBusy(true);
        try {
            await setNote(account.id, text.trim());
            dialog.toast(t(text.trim() ? 'profile.noteSaved' : 'profile.noteRemoved'));
            onBack();
        } catch {
            dialog.toast(t('profile.noteFailed'));
            setBusy(false);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.borderColor, backgroundColor: colors.cardBackground }]}>
                <IconButton icon="arrow-back" accessibilityLabel={t('common.goBack')} onPress={onBack} />
                <Text accessibilityRole="header" style={[type.name, styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                    {t('profile.noteTitle', { acct: account.acct })}
                </Text>
                <View style={styles.spacer} />
            </View>

            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <Text style={[type.meta, { color: colors.textMuted }]}>{t('profile.noteHint')}</Text>
                <TextInput
                    value={text}
                    onChangeText={setText}
                    placeholder={t('profile.notePlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    accessibilityLabel={t('profile.note')}
                    multiline
                    autoFocus
                    maxLength={NOTE_LIMIT}
                    textAlignVertical="top"
                    style={[type.body, styles.input, { color: colors.textPrimary, backgroundColor: colors.inputBackground }]}
                />
                <PillButton label={t('profile.noteSave')} onPress={save} disabled={busy || text.trim() === note.trim()} loading={busy} />
            </ScrollView>
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
    content: {
        gap: space.md,
        padding: space.lg,
    },
    input: {
        minHeight: 120,
        maxHeight: 240,
        borderRadius: radii.input,
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
    },
});

export default AccountNote;
