import { StyleSheet } from 'react-native';
import { ThemeColors } from '../../services/themeContext';
import { radii, space } from '../../services/theme/shape';

export const makeStyles = (colors: ThemeColors) =>
    StyleSheet.create({
        card: {
            marginHorizontal: space.lg,
            marginBottom: space.md,
            padding: space.md,
            borderRadius: radii.card,
            gap: space.sm,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        providerBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: space.sm,
            paddingVertical: 3,
            borderRadius: radii.pill,
            backgroundColor: colors.accentSoft,
        },
        providerText: {
            fontSize: 11,
            color: colors.accentText,
        },
        usageText: {
            fontSize: 12,
            color: colors.textMuted,
        },
        imageContainer: {
            width: '100%',
            height: 160,
            borderRadius: radii.well,
            overflow: 'hidden',
            backgroundColor: colors.inputBackground,
            marginTop: 2,
        },
        image: {
            width: '100%',
            height: '100%',
        },
        title: {
            fontSize: 16,
            lineHeight: 22,
            color: colors.textPrimary,
        },
        description: {
            fontSize: 13.5,
            lineHeight: 19,
            color: colors.textSecondary,
        },
        actions: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: space.sm,
            marginTop: 4,
        },
    });
