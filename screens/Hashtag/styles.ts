import { StyleSheet } from 'react-native';
import { ThemeColors } from '../../services/themeContext';
import { space } from '../../services/theme/shape';
import { TAB_BAR_CLEARANCE } from '../../components/TabBar/styles';

export const makeStyles = (colors: ThemeColors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingBottom: space.sm,
        paddingHorizontal: space.lg,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.borderColor,
        backgroundColor: colors.cardBackground,
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
        color: colors.textPrimary,
    },
    headerSpacer: {
        width: 44,
    },
    // The tag, its activity and the follow button, above the posts
    intro: {
        alignItems: 'center',
        gap: space.sm,
        paddingTop: space.xl,
        paddingBottom: space.lg,
        paddingHorizontal: space.xl,
    },
    tag: {
        color: colors.textPrimary,
        textAlign: 'center',
    },
    usage: {
        color: colors.textSecondary,
        textAlign: 'center',
    },
    followHint: {
        color: colors.textMuted,
        textAlign: 'center',
    },
    listContent: {
        paddingBottom: TAB_BAR_CLEARANCE,
    },
    empty: {
        alignItems: 'center',
        paddingTop: space.xl,
        paddingHorizontal: space.xl,
    },
    emptyText: {
        color: colors.textMuted,
        textAlign: 'center',
    },
    footer: {
        paddingVertical: space.lg,
    },
});
