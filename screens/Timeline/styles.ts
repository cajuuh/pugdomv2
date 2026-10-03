import { StyleSheet } from 'react-native';
import { ThemeColors } from '../../services/themeContext';
import { TAB_BAR_CLEARANCE } from '../../components/TabBar/styles';
import { radii, space } from '../../services/theme/shape';

export const makeStyles = (colors: ThemeColors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center'
    },
    header: {
        height: 60,
        backgroundColor: colors.cardBackground,
        justifyContent: 'center',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: colors.borderColor
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.textPrimary,
    },
    feedPicker: {
        paddingHorizontal: 16,
        paddingTop: 6,
        paddingBottom: 10,
    },
    list: {
        flex: 1,
    },
    // The "N new posts" pill floats over the top of the list
    newPostsWrap: {
        position: 'absolute',
        top: space.sm,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 10,
    },
    newPosts: {
        minHeight: 40,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: radii.pill,
        backgroundColor: colors.accentColor,
        shadowColor: colors.shadowColor,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 10,
        elevation: 6,
    },
    newPostsAvatars: {
        flexDirection: 'row',
    },
    newPostsAvatar: {
        borderRadius: radii.pill,
        borderWidth: 2,
        borderColor: colors.accentColor,
    },
    newPostsAvatarStacked: {
        marginLeft: -8,
    },
    newPostsText: {
        color: colors.buttonTextColor,
    },
    footer: {
        paddingVertical: 20,
        alignItems: 'center',
    },
    listContent: {
        paddingTop: 8,
        paddingBottom: TAB_BAR_CLEARANCE,
    },
    emptyContainer: {
        flex: 1,
        marginTop: 100,
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center'
    },
    emptyText: {
        color: colors.textSecondary,
        fontSize: 16,
        textAlign: 'center'
    }
})