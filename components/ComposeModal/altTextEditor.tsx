import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../../services/themeContext';
import { useI18n } from '../../services/i18n/i18nContext';
import { mediaColors } from '../../services/theme/media';
import { radii, space } from '../../services/theme/shape';
import { fitSize, Point } from '../../services/media/geometry';
import { PillButton } from '../ui';
import { CharacterCounter } from './characterCounter';

const MAX_IMAGE_HEIGHT = 220;
const CROSSHAIR = 28;

interface AltTextEditorProps {
    uri: string;
    width: number;
    height: number;
    value: string;
    onChange: (text: string) => void;
    maxLength: number;
    // The focal point, 0–1 from the top left; none means the middle
    focus?: Point;
    onFocusChange: (focus: Point | undefined) => void;
}

// Shown in place of the post while describing an image, so the compose sheet's keyboard handling
// carries over (a sheet on top of it would need its own). Tapping the image picks its focal point.
export const AltTextEditor: React.FC<AltTextEditorProps> = ({ uri, width, height, value, onChange, maxLength, focus, onFocusChange }) => {
    const { colors, type } = useTheme();
    const { t } = useI18n();
    const [boxWidth, setBoxWidth] = useState(0);
    const shown = fitSize({ width: boxWidth, height: MAX_IMAGE_HEIGHT }, { width: width || 1, height: height || 1 });

    return (
        <View style={styles.container}>
            <View onLayout={event => setBoxWidth(event.nativeEvent.layout.width)} style={styles.imageRow} testID="focus-image-box">
                {shown.width > 0 && (
                    <Pressable
                        onPress={event => {
                            const { locationX, locationY } = event.nativeEvent;
                            onFocusChange({
                                x: Math.min(Math.max(locationX / shown.width, 0), 1),
                                y: Math.min(Math.max(locationY / shown.height, 0), 1),
                            });
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={t('attachments.focusLabel')}
                        accessibilityHint={t('attachments.focusHint')}
                        style={{ width: shown.width, height: shown.height }}
                    >
                        <Image
                            source={{ uri }}
                            style={[styles.image, { backgroundColor: colors.inputBackground }]}
                            resizeMode="contain"
                            accessibilityIgnoresInvertColors
                        />
                        {focus && (
                            <View
                                pointerEvents="none"
                                testID="focus-crosshair"
                                style={[styles.crosshair, { left: focus.x * shown.width - CROSSHAIR / 2, top: focus.y * shown.height - CROSSHAIR / 2 }]}
                            >
                                <View style={styles.crosshairDot} />
                            </View>
                        )}
                    </Pressable>
                )}
            </View>
            <View style={styles.focusRow}>
                <Text style={[type.meta, styles.hint, { color: colors.textMuted }]}>{t('attachments.focusHint')}</Text>
                {focus && <PillButton label={t('attachments.focusReset')} size="small" variant="subtle" onPress={() => onFocusChange(undefined)} />}
            </View>
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
    imageRow: {
        alignItems: 'center',
    },
    image: {
        width: '100%',
        height: '100%',
        borderRadius: radii.input,
    },
    // A ring with a dot, light on a dark outline so it shows on any picture
    crosshair: {
        position: 'absolute',
        width: CROSSHAIR,
        height: CROSSHAIR,
        borderRadius: CROSSHAIR / 2,
        borderWidth: 2,
        borderColor: mediaColors.ink,
        backgroundColor: mediaColors.scrimLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    crosshairDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: mediaColors.ink,
    },
    focusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
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
