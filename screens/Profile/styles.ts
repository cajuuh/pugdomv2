import { StyleSheet } from "react-native";
import { ThemeColors } from '../../services/themeContext';
import { TAB_BAR_CLEARANCE } from "../../components/TabBar/styles";

export const makeStyles = (colors: ThemeColors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background
    },
    contentContainer: {
        paddingBottom: TAB_BAR_CLEARANCE,
    },
    headerBannerContainer: {
        width: '100%',
        height: 160, //magic numbers for now
        backgroundColor: colors.cardBackground
    },
    headerBanner: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    gradientFallback: {
        backgroundColor: colors.accentColor
    },
    profileInfoContainer: {
        paddingHorizontal: 20,
        alignItems: 'center'
    },
    avatarWrapper: {
        marginTop: -45,
        marginBottom: 16
    },
    avatarBorder: {
        borderWidth: 4,
        borderColor: colors.background,
        borderRadius: 50
    },
    displayName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.textPrimary,
        textAlign: 'center'
    },
    username: {
        fontSize: 14,
        color: colors.textSecondary,
        marginTop: 4,
        marginBottom: 24,
        textAlign: 'center'
    },
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 28,
        gap: 12
    },
    statsCard: {
        flex: 1,
        backgroundColor: colors.cardBackground,
        paddingVertical: 16,
        alignItems: 'center',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.borderColor
    },
    statNumber: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.textPrimary
    },
    statLabel: {
        fontSize: 12,
        color: colors.textSecondary,
        marginTop: 4
    },
    bioContainer: {
        width: '100%',
        backgroundColor: colors.cardBackground,
        padding: 20,
        borderRadius: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: colors.borderColor
    },
    bioTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.accentText,
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    bioText: {
        fontSize: 15,
        lineHeight: 22,
        color: colors.textPrimary
    },
    actionButtonsContainer: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 20
    },
    actionButton: {
        flex: 1,
        height: 48,
        borderRadius: 12
    },
    outlineButton: {
        backgroundColor: 'transparent'
    },
    buttonLabel: {
        fontSize: 15,
        fontWeight: '600'
    },
    logoutButton: {
        marginTop: 12,
        height: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center'
    },
    logoutLabel: {
        fontSize: 15,
        fontWeight: '600'
    }
})