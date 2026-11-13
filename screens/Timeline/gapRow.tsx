import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { PillButton } from '../../components/ui';
import { useI18n } from '../../services/i18n/i18nContext';
import { useTheme } from '../../services/themeContext';
import { radii, space } from '../../services/theme/shape';
import { Gap, GapEnd } from '../../services/mastodon/timelineGaps';

interface GapRowProps {
    gap: Gap;
    loading: boolean;
    onLoad: (gap: Gap, from: GapEnd) => void;
}

// Where posts weren't loaded: fill it from the end you're reading toward
export const GapRow = ({ gap, loading, onLoad }: GapRowProps) => {
    const { colors, type } = useTheme();
    const { t } = useI18n();
    return (
        <View testID="timeline-gap" style={[styles.row, { borderColor: colors.borderColor }]}>
            <Text style={[type.meta, { color: colors.textMuted }]}>{t('timeline.gap')}</Text>
            {loading ? (
                <ActivityIndicator color={colors.accentColor} style={styles.spinner} />
            ) : (
                <View style={styles.buttons}>
                    <PillButton label={t('timeline.gapNewer')} icon="arrow-up" size="small" variant="subtle" onPress={() => onLoad(gap, 'newer')} />
                    <PillButton label={t('timeline.gapOlder')} icon="arrow-down" size="small" variant="subtle" onPress={() => onLoad(gap, 'older')} />
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    row: {
        alignItems: 'center',
        gap: space.sm,
        marginHorizontal: space.lg,
        marginBottom: space.md,
        padding: space.md,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderRadius: radii.input,
    },
    buttons: {
        flexDirection: 'row',
        gap: space.sm,
    },
    spinner: {
        height: 32,
    },
});
