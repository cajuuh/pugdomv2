import React, { useState } from 'react';
import { Platform, Share, StyleProp, StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { saveToGallery } from '../../services/media/save';
import { dialog } from '../../services/dialog';
import { mediaColors } from '../../services/theme/media';
import { useI18n } from '../../services/i18n/i18nContext';
import { useTheme } from '../../services/themeContext';

// "Save" in the media viewer: the original goes to the phone's gallery. If that fails, the link can be shared instead.
export const SaveMediaButton = ({ url, style }: { url: string; style?: StyleProp<ViewStyle> }) => {
    const { t } = useI18n();
    const { type } = useTheme();
    const [saving, setSaving] = useState(false);

    const save = async () => {
        setSaving(true);
        try {
            await saveToGallery(url);
            dialog.toast(t('media.saved'));
        } catch (error) {
            console.warn('Saving media failed:', error);
            dialog.alert(t('media.saveFailedTitle'), t('media.saveFailed'), [
                { text: t('common.cancel'), style: 'cancel' },
                // iOS builds a link preview from `url`; Android only shares `message`
                { text: t('media.shareLink'), onPress: () => Share.share(Platform.OS === 'ios' ? { url } : { message: url }).catch(() => {}) },
            ]);
        } finally {
            setSaving(false);
        }
    };

    return (
        <TouchableOpacity
            onPress={save}
            disabled={saving}
            style={[styles.button, style]}
            accessibilityRole="button"
            accessibilityLabel={t(saving ? 'media.saving' : 'media.save')}
            accessibilityState={{ busy: saving, disabled: saving }}
        >
            <Ionicons name="download-outline" size={18} color={mediaColors.ink} />
            <Text style={[type.name, { color: mediaColors.ink }]}>{t(saving ? 'media.saving' : 'media.save')}</Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    // Beside the close button, top right; "View post" sits top left
    button: {
        position: 'absolute',
        zIndex: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 38,
        paddingHorizontal: 14,
        borderRadius: 19,
        backgroundColor: mediaColors.scrim,
    },
});
