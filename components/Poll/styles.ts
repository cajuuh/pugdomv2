import { StyleSheet } from 'react-native';
import { ThemeColors } from '../../services/themeContext';
import { space } from '../../services/theme/shape';

const ROW_RADIUS = space.md;

export const makeStyles = (colors: ThemeColors) => StyleSheet.create({
    container: {
        padding: 10,
        gap: space.sm,
    },
    option: {
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
        borderRadius: ROW_RADIUS,
        borderWidth: 1.5,
        borderColor: colors.borderColor,
        backgroundColor: colors.cardBackground,
    },
    optionSelected: {
        borderWidth: 2,
        borderColor: colors.accentColor,
        backgroundColor: colors.accentSoft,
    },
    indicator: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2,
        borderColor: colors.textMuted,
        alignItems: 'center',
        justifyContent: 'center',
    },
    indicatorMultiple: {
        borderRadius: 5,
    },
    indicatorSelected: {
        borderWidth: 0,
        backgroundColor: colors.accentColor,
    },
    optionTitle: {
        flex: 1,
        fontSize: 14.5,
        color: colors.textPrimary,
    },
    result: {
        minHeight: 40,
        justifyContent: 'center',
        borderRadius: ROW_RADIUS,
        overflow: 'hidden',
        backgroundColor: colors.cardBackground,
    },
    resultBar: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        backgroundColor: colors.accentSoft,
    },
    resultBarWinner: {
        backgroundColor: colors.accentColor,
    },
    resultLabels: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        paddingHorizontal: space.md,
        paddingVertical: 10,
    },
    resultTitle: {
        flexShrink: 1,
        fontSize: 14,
        color: colors.textPrimary,
    },
    resultTitleOnAccent: {
        color: colors.buttonTextColor,
    },
    resultPercent: {
        marginLeft: 'auto',
        fontSize: 14,
        color: colors.textSecondary,
    },
    resultPercentWinner: {
        color: colors.textPrimary,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: space.sm,
        paddingTop: 2,
        paddingHorizontal: space.xs,
    },
    footerText: {
        color: colors.textMuted,
    },
});
