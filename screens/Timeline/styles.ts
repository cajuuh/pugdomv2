import { StyleSheet } from 'react-native';
import { ThemeColors } from '../../services/themeContext';
import { TAB_BAR_CLEARANCE } from '../../components/TabBar/styles';

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
    listContent: {
        paddingTop: 8,
        paddingBottom: TAB_BAR_CLEARANCE,
    },
    emptyContainer: {
        marginTop: 100,
        alignItems: 'center',
        justifyContent: 'center'
    },
    emptyText: {
        color: colors.textSecondary,
        fontSize: 16,
        textAlign: 'center'
    }
})