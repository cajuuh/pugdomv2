import { StyleSheet } from 'react-native';
import { ThemeColors } from '../../services/themeContext';
import { radii, space } from '../../services/theme/shape';
import { TAB_BAR_CLEARANCE } from '../../components/TabBar/styles';

export const makeStyles = (colors: ThemeColors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    field: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        height: 44,
        marginHorizontal: space.lg,
        marginTop: space.xs,
        paddingHorizontal: space.md,
        borderRadius: radii.pill,
        backgroundColor: colors.inputBackground,
    },
    input: {
        flex: 1,
        color: colors.textPrimary,
        paddingVertical: 0,
    },
    tabsRow: {
        flexGrow: 0,
    },
    tabs: {
        paddingHorizontal: space.lg,
        paddingTop: space.md,
        paddingBottom: space.sm,
    },
    list: {
        flex: 1,
    },
    listContent: {
        paddingBottom: TAB_BAR_CLEARANCE,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: space.lg,
        paddingBottom: space.xs,
        paddingHorizontal: space.lg,
    },
    sectionTitle: {
        color: colors.textMuted,
    },
    seeAll: {
        color: colors.accentText,
    },
    // Nothing typed yet: the pug and what search can find
    start: {
        alignItems: 'center',
        gap: space.md,
        paddingTop: space.xl * 2,
        paddingHorizontal: space.xl,
    },
    startText: {
        color: colors.textPrimary,
        textAlign: 'center',
    },
    hint: {
        color: colors.textMuted,
        textAlign: 'center',
    },
    status: {
        alignItems: 'center',
        gap: space.sm,
        paddingTop: space.xl,
        paddingHorizontal: space.xl,
    },
    statusText: {
        color: colors.textMuted,
        textAlign: 'center',
    },
    note: {
        marginHorizontal: space.lg,
        marginTop: space.md,
        padding: space.md,
        borderRadius: radii.well,
        backgroundColor: colors.accentSoft,
    },
    noteText: {
        color: colors.textSecondary,
    },
    footer: {
        paddingVertical: space.lg,
    },
    // Recent searches above explore
    recentHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: space.lg,
        paddingTop: space.sm,
        paddingBottom: 2,
    },
    recentTitle: {
        color: colors.textMuted,
    },
    clearRecent: {
        color: colors.textMuted,
        fontSize: 12,
    },
    recentRow: {
        flexGrow: 0,
    },
    recentList: {
        flexDirection: 'row',
        gap: space.xs,
        paddingHorizontal: space.lg,
        paddingVertical: space.xs,
    },
    recentChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 30,
        paddingLeft: 10,
        paddingRight: 6,
        borderRadius: radii.pill,
        backgroundColor: colors.inputBackground,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.borderColor,
    },
    recentText: {
        fontSize: 12.5,
        color: colors.textPrimary,
        maxWidth: 160,
    },
    recentRemove: {
        padding: 2,
    },
    exploreContainer: {
        flex: 1,
    },
    emptyExplore: {
        alignItems: 'center',
        gap: space.md,
        paddingTop: space.xl * 1.5,
        paddingHorizontal: space.xl,
    },
    emptyExploreText: {
        color: colors.textMuted,
        textAlign: 'center',
    },
});

