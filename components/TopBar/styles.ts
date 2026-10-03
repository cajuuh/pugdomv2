import { StyleSheet } from 'react-native';
import { ThemeColors } from '../../services/themeContext';
import { radii, space } from '../../services/theme/shape';

export const HEADER_HEIGHT = 52;

export const makeStyles = (colors: ThemeColors) => StyleSheet.create({
    safeArea: {
        backgroundColor: colors.background,
    },
    container: {
        height: HEADER_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: space.lg,
    },
    avatarButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    wordmark: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
    },
    wordmarkText: {
        fontSize: 24,
        lineHeight: 30,
        color: colors.textPrimary,
    },
    settingsButton: {
        alignItems: 'flex-end',
    },
    modalRoot: {
        flex: 1,
    },
    modalOverlay: {
        ...StyleSheet.absoluteFill,
        backgroundColor: colors.scrim,
    },
    menu: {
        position: 'absolute',
        left: space.lg,
        minWidth: 180,
        paddingVertical: space.xs,
        borderRadius: radii.well,
        borderWidth: 1,
        borderColor: colors.borderColor,
        backgroundColor: colors.cardBackground,
        shadowColor: colors.shadowColor,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.16,
        shadowRadius: 16,
        elevation: 6,
    },
    menuItem: {
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingHorizontal: space.lg,
    },
    menuText: {
        fontSize: 14,
        color: colors.textPrimary,
    },
    menuTextDanger: {
        color: colors.dangerColor,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        marginHorizontal: space.sm,
        backgroundColor: colors.borderColor,
    },
});
