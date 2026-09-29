import { StyleSheet } from 'react-native';
import { ThemeColors } from '../../services/themeContext';
import { mediaColors } from '../../services/theme/media';

export const makeStyles = (colors: ThemeColors) => StyleSheet.create({
    cardContainer: {
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 16,
        marginHorizontal: 16,
        marginVertical: 10,
        borderWidth: 1,
        shadowColor: colors.shadowColor,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    boostedHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 6
    },
    boostedAvatar: {
        marginHorizontal: 6,
        borderRadius: 9
    },
    boostedText: {
        fontSize: 12,
        color: colors.textMuted,
        fontWeight: '600'
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10
    },
    mainRow: {
        flexDirection: 'row',
    },
    leftColumn: {
        alignItems: 'center',
        marginRight: 10,
    },
    rightColumn: {
        flex: 1,
    },
    namesContainer: {
        flex: 1,
        justifyContent: 'center'
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap'
    },
    displayName: {
        fontSize: 15,
        fontWeight: 'bold',
        color: colors.textPrimary,
        marginRight: 4
    },
    username: {
        fontSize: 13,
        color: colors.textSecondary
    },
    timeText: {
        fontSize: 12,
        color: colors.textMuted
    },
    spoilerContainer: {
        backgroundColor: colors.inputBackground,
        padding: 12,
        borderRadius: 10,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: colors.borderColor,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    spoilerText: {
        color: colors.textPrimary,
        fontSize: 14,
        fontWeight: '600',
        flex: 1
    },
    spoilerButtonLabel: {
        fontSize: 12,
        fontWeight: 'bold'
    },
    contentContainer: {
        marginBottom: 12
    },
    contentText: {
        fontSize: 15,
        lineHeight: 22,
        color: colors.textPrimary
    },
    mediaContainer: {
        width: '100%',
        height: 200,
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 12,
        backgroundColor: colors.inputBackground
    },
    singleMedia: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover'
    },
    mediaGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12
    },
    gridMedia: {
        height: 120,
        borderRadius: 8,
        backgroundColor: colors.inputBackground,
        resizeMode: 'cover'
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: colors.borderColor,
        paddingTop: 12,
        marginTop: 8
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 8,
        paddingVertical: 4
    },
    actionCount: {
        fontSize: 12,
        color: colors.textMuted,
        fontWeight: '600'
    },
    linkPreviewContainer: {
        backgroundColor: colors.inputBackground,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.borderColor,
        marginBottom: 12,
    },
    linkPreviewImage: {
        width: '100%',
        height: 150,
        resizeMode: 'cover',
    },
    linkPreviewContent: {
        padding: 12,
        gap: 4,
    },
    linkPreviewProvider: {
        fontSize: 11,
        color: colors.accentText,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    linkPreviewTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: colors.textPrimary,
    },
    linkPreviewDescription: {
        fontSize: 12,
        color: colors.textSecondary,
        lineHeight: 16,
    },
    blurContainer: {
        overflow: 'hidden',
        borderRadius: 12,
        marginBottom: 12,
    },
    revealButton: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: mediaColors.scrimLight,
    },
    revealText: {
        color: mediaColors.ink,
        marginTop: 8,
        fontWeight: 'bold',
        fontSize: 14,
    }
});