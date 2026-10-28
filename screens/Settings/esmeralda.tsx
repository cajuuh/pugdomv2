import React, { useRef, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, PillButton } from '../../components/ui';
import { ThemeColors, useTheme } from '../../services/themeContext';
import { useThemedStyles } from '../../services/theme/useThemedStyles';
import { radii, space } from '../../services/theme/shape';
import { useI18n } from '../../services/i18n/i18nContext';

// Taps in a row on the App Version row, each within a second of the last, as with Android's developer options
export const TAPS_TO_OPEN = 7;
const TAP_WINDOW_MS = 1000;
// The photo is 3:4; it takes at most this share of the height between the system bars, so the text and button below always fit
const PHOTO_MAX_HEIGHT_SHARE = 0.55;

// The easter egg: counts taps; `open` turns true on the 7th
export function useEsmeraldaTaps() {
    const [open, setOpen] = useState(false);
    const taps = useRef({ count: 0, last: 0 });
    const tap = () => {
        const now = Date.now();
        taps.current.count = now - taps.current.last <= TAP_WINDOW_MS ? taps.current.count + 1 : 1;
        taps.current.last = now;
        if (taps.current.count >= TAPS_TO_OPEN) {
            taps.current.count = 0;
            setOpen(true);
        }
    };
    return { open, tap, close: () => setOpen(false) };
}

// Esmeralda, the pug pugdon was made for
export const Esmeralda: React.FC<{ visible: boolean; onClose: () => void }> = ({ visible, onClose }) => {
    const { type } = useTheme();
    const styles = useThemedStyles(makeStyles);
    const { t } = useI18n();
    // Explicit size: with a percentage width the image kept its own pixel size and pushed the text off-screen
    const window = useWindowDimensions();
    // Clear of the status bar and Android's navigation bar (three buttons are taller than the gesture pill)
    const insets = useSafeAreaInsets();
    const usableHeight = window.height - insets.top - insets.bottom;
    const photoWidth = Math.min(window.width - insets.left - insets.right - 2 * (space.xl + space.md), usableHeight * PHOTO_MAX_HEIGHT_SHARE * 3 / 4);
    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
            <Pressable
                style={[styles.backdrop, { paddingTop: space.xl + insets.top, paddingBottom: space.xl + insets.bottom, paddingLeft: space.xl + insets.left, paddingRight: space.xl + insets.right }]}
                onPress={onClose}
                accessibilityLabel={t('esmeralda.close')}
            >
                {/* Taps on the card don't close it */}
                <Pressable onPress={() => {}} accessible={false}>
                    <Card style={styles.card}>
                        <Image source={require('../../assets/esmeralda.jpg')} style={[styles.photo, { width: photoWidth, height: photoWidth * 4 / 3 }]} accessibilityLabel={t('esmeralda.photo')} />
                        <Text style={[type.title, styles.name]} accessibilityRole="header">Esmeralda</Text>
                        <Text style={[type.body, styles.text]}>{t('esmeralda.text')}</Text>
                        <PillButton label={t('esmeralda.close')} onPress={onClose} style={styles.button} />
                    </Card>
                </Pressable>
            </Pressable>
        </Modal>
    );
};

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: colors.scrim,
        justifyContent: 'center',
    },
    card: {
        padding: space.md,
        gap: space.sm,
        alignItems: 'center',
    },
    photo: {
        borderRadius: radii.well,
    },
    name: {
        color: colors.textPrimary,
        marginTop: space.xs,
    },
    text: {
        color: colors.textSecondary,
        textAlign: 'center',
    },
    button: {
        marginTop: space.xs,
        alignSelf: 'stretch',
    },
});
