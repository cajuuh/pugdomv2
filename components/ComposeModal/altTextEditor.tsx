import React from 'react';
import { Image, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../../services/themeContext';
import { useI18n } from '../../services/i18n/i18nContext';
import { radii, space } from '../../services/theme/shape';
import { CharacterCounter } from './characterCounter';

interface AltTextEditorProps {
    uri: string;
    width: number;
    height: number;
    value: string;
    onChange: (text: string) => void;
    maxLength: number;
}

// Shown in place of the post while describing an image, so the compose sheet's keyboard handling
// carries over (a sheet on top of it would need its own)
export const AltTextEditor: React.FC<AltTextEditorProps> = ({ uri, width, height, value, onChange, maxLength }) => {
    const { colors, type } = useTheme();
    const { t } = useI18n();
    const aspectRatio = width > 0 && height > 0 ? width / height : 1;

    return (
        <View style={styles.container}>
            <Image
                source={{ uri }}
                style={[styles.image, { aspectRatio, backgroundColor: colors.inputBackground }]}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
            />
            <TextInput
                value={value}
                onChangeText={onChange}
                placeholder={t('attachments.altPlaceholder')}
                placeholderTextColor={colors.textMuted}
                accessibilityLabel={t('attachments.altLabel')}
                accessibilityHint={t('attachments.altHint')}
                multiline
                autoFocus
                style={[type.body, styles.input, { color: colors.textPrimary, backgroundColor: colors.inputBackground }]}
            />
            <View style={styles.footer}>
                <Text style={[type.meta, styles.hint, { color: colors.textMuted }]}>{t('attachments.altHint')}</Text>
                <CharacterCounter remaining={maxLength - value.length} max={maxLength} />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        gap: space.md,
        paddingTop: space.sm,
    },
    image: {
        alignSelf: 'center',
        maxHeight: 220,
        maxWidth: '100%',
        borderRadius: radii.input,
    },
    input: {
        minHeight: 120,
        padding: space.md,
        borderRadius: radii.input,
        textAlignVertical: 'top',
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
    },
    hint: {
        flex: 1,
    },
});
