import { StyleSheet, Platform } from 'react-native';
import { ThemeColors } from '../../services/themeContext';

export const makeStyles = (colors: ThemeColors) => StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: colors.background,
    },
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    contentContainer: {
        padding: 16,
        paddingBottom: 40,
    },
    header: {
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderColor,
        backgroundColor: colors.cardBackground,
    },
    backButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.textPrimary,
    },
    placeholder: {
        width: 44,
    },
    userCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: colors.cardBackground,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.borderColor,
        marginBottom: 24,
    },
    userAvatar: {
        borderWidth: 2,
        borderColor: colors.accentColor,
    },
    userInfo: {
        marginLeft: 16,
        flex: 1,
    },
    displayName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.textPrimary,
    },
    username: {
        fontSize: 14,
        color: colors.textSecondary,
        marginTop: 2,
    },
    instanceText: {
        fontSize: 11,
        color: colors.accentText,
        fontWeight: '600',
        marginTop: 4,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.textMuted,
        letterSpacing: 1,
        marginBottom: 8,
        marginLeft: 4,
    },
    settingsGroup: {
        backgroundColor: colors.cardBackground,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.borderColor,
        marginBottom: 24,
        overflow: 'hidden',
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
        height: 54,
    },
    settingLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    rowIcon: {
        marginRight: 12,
        width: 24,
        textAlign: 'center',
    },
    settingLabel: {
        fontSize: 15,
        color: colors.textPrimary,
        fontWeight: '500',
    },
    settingValue: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    divider: {
        height: 1,
        backgroundColor: colors.borderColor,
        marginHorizontal: 16,
    },
    logoutButton: {
        marginTop: 8,
        height: 48,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoutLabel: {
        fontSize: 16,
        fontWeight: '600',
    },
    themeSelectorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    themePill: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    themePillText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
});
