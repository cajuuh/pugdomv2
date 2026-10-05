import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../services/themeContext';
import { useI18n } from '../../services/i18n/i18nContext';
import { radii, space } from '../../services/theme/shape';
import { PillButton, PugMark } from '../ui';
import { BottomSheet } from './optionSheet';

interface AltReminderSheetProps {
    visible: boolean;
    // How many images have no description
    count: number;
    onDescribe: () => void;
    onPostAnyway: () => void;
    onClose: () => void;
}

// The pug's gentle nudge to describe images before posting, once per post
export const AltReminderSheet: React.FC<AltReminderSheetProps> = ({ visible, count, onDescribe, onPostAnyway, onClose }) => {
    const { colors, type, coat } = useTheme();
    const { t, tn } = useI18n();

    return (
        <BottomSheet visible={visible} title={t('attachments.reminderTitle')} onClose={onClose}>
            <View style={styles.row}>
                <PugMark coat={coat} size={64} />
                <View style={[styles.bubble, { backgroundColor: colors.accentSoft }]}>
                    <View style={[styles.tail, { borderRightColor: colors.accentSoft }]} />
                    <Text style={[type.body, { color: colors.textPrimary }]}>{tn('attachments.reminder', count)}</Text>
                </View>
            </View>
            <View style={styles.buttons}>
                <PillButton label={t('attachments.describeNow')} icon="create-outline" onPress={onDescribe} />
                <PillButton label={t('attachments.postAnyway')} variant="ghost" onPress={onPostAnyway} />
            </View>
        </BottomSheet>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingHorizontal: space.xs,
        paddingVertical: space.sm,
    },
    bubble: {
        flex: 1,
        padding: space.md,
        borderRadius: radii.well,
    },
    // A small triangle pointing at the pug
    tail: {
        position: 'absolute',
        left: -8,
        top: '50%',
        marginTop: -8,
        width: 0,
        height: 0,
        borderTopWidth: 8,
        borderBottomWidth: 8,
        borderRightWidth: 8,
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
    },
    buttons: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: space.sm,
        marginTop: space.md,
        paddingHorizontal: space.xs,
    },
});
