import { StyleSheet } from 'react-native';
import { ThemeColors } from '../../services/themeContext';
import { TAB_BAR_CLEARANCE } from '../../components/TabBar/styles';

export const makeStyles = (colors: ThemeColors) => StyleSheet.create({
    container: {
        flex: 1,
    },
    listContent: {
        paddingBottom: TAB_BAR_CLEARANCE,
        paddingTop: 10,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        color: colors.textSecondary,
        fontSize: 16,
        fontWeight: '500',
    },
    notificationCard: {
        flexDirection: 'column',
        padding: 16,
        borderRadius: 20,
        marginHorizontal: 16,
        marginBottom: 16,
        borderWidth: 1,
        backgroundColor: colors.cardBackground,
        borderColor: colors.borderColor,
        shadowColor: colors.shadowColor,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 3,
    },
    asymmetricTagLayer: {
        alignSelf: 'flex-start',
        marginLeft: 8,
        backgroundColor: colors.accentSoft,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    tagText: {
        color: colors.accentText,
        fontSize: 11,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    headerArchitecture: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    avatar: {
        marginRight: 12,
    },
    actionText: {
        flex: 1,
        color: colors.textPrimary,
        fontSize: 15,
        fontWeight: '500',
    },
    displayName: {
        fontWeight: 'bold',
    },
    // ui-lib's Text sets its own default color, so nested text doesn't inherit actionText's
    actionVerb: {
        color: colors.textPrimary,
    },
    statusPreview: {
        color: colors.textPrimary,
        fontSize: 15,
        lineHeight: 22,
        marginTop: 4,
        opacity: 0.9,
    },
    followButton: {
        marginTop: 12,
        alignSelf: 'flex-start',
    },
    followState: {
        color: colors.textSecondary,
        marginTop: 12,
        fontSize: 13,
        fontWeight: '600',
    },
});

