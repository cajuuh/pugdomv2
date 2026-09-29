import { StyleSheet } from 'react-native';
import { ThemeColors } from '../../services/themeContext';
import { TAB_BAR_CLEARANCE } from '../../components/TabBar/styles';
import { radii, space } from '../../services/theme/shape';

const ROW_PADDING = space.lg;
const AVATAR_SIZE = 44;
const ROW_GAP = space.md;
const FAVOURITE_SIZE = 34;

export const makeStyles = (colors: ThemeColors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 6,
        paddingLeft: 20,
        paddingRight: space.lg,
    },
    title: {
        color: colors.textPrimary,
    },
    markRead: {
        backgroundColor: colors.inputBackground,
        borderRadius: radii.pill,
    },
    filters: {
        paddingTop: 14,
        paddingBottom: 6,
        paddingLeft: 20,
        paddingRight: space.lg,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        paddingHorizontal: space.md,
        paddingTop: 10,
        paddingBottom: TAB_BAR_CLEARANCE,
    },
    footer: {
        paddingVertical: 20,
        alignItems: 'center',
    },
    emptyContainer: {
        alignItems: 'center',
        padding: 40,
    },
    emptyText: {
        color: colors.textSecondary,
    },
    sectionLabel: {
        marginHorizontal: space.sm,
        marginTop: space.xs,
        marginBottom: 10,
    },
    // Space between the previous group and the next section's label
    sectionLabelSpaced: {
        marginTop: 18,
    },
    // Each row is a slice of its section's card, so the list stays virtualized
    segment: {
        backgroundColor: colors.cardBackground,
        borderColor: colors.borderColor,
        borderLeftWidth: StyleSheet.hairlineWidth,
        borderRightWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
    },
    segmentFirst: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopLeftRadius: radii.card,
        borderTopRightRadius: radii.card,
    },
    segmentLast: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomLeftRadius: radii.card,
        borderBottomRightRadius: radii.card,
    },
    // Hairline indented to where the text starts
    separator: {
        height: StyleSheet.hairlineWidth,
        marginLeft: ROW_PADDING + AVATAR_SIZE + ROW_GAP,
        backgroundColor: colors.borderColor,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: ROW_GAP,
        paddingVertical: 14,
        paddingHorizontal: ROW_PADDING,
    },
    rowCentered: {
        alignItems: 'center',
    },
    rowPressed: {
        backgroundColor: colors.inputBackground,
    },
    content: {
        flex: 1,
        minWidth: 0,
        gap: 6,
    },
    stack: {
        gap: 6,
    },
    followContent: {
        gap: 1,
    },
    headline: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: space.sm,
    },
    // Wraps to two lines, then truncates, so long names never run under the time
    headlineText: {
        flex: 1,
        color: colors.textPrimary,
        fontSize: 14.5,
        lineHeight: 20,
    },
    displayName: {
        color: colors.textPrimary,
        fontSize: 14.5,
    },
    // ui-lib and nested Text don't inherit the parent's color reliably, so each part sets its own
    action: {
        color: colors.textSecondary,
        fontSize: 14.5,
    },
    time: {
        flexShrink: 0,
        color: colors.textMuted,
    },
    mentionText: {
        color: colors.textPrimary,
        fontSize: 15,
        lineHeight: 21,
    },
    snippet: {
        paddingVertical: space.sm,
        paddingHorizontal: 10,
        borderRadius: radii.input,
    },
    snippetText: {
        color: colors.textSecondary,
        fontSize: 13.5,
        lineHeight: 19,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        marginTop: space.xs,
    },
    favourite: {
        width: FAVOURITE_SIZE,
        height: FAVOURITE_SIZE,
        borderRadius: FAVOURITE_SIZE / 2,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.borderColor,
        backgroundColor: colors.cardBackground,
        alignItems: 'center',
        justifyContent: 'center',
    },
    favouriteOn: {
        borderColor: colors.accentSoft,
        backgroundColor: colors.accentSoft,
    },
    handle: {
        color: colors.textMuted,
    },
    followState: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        height: 34,
        paddingHorizontal: space.md,
        borderRadius: radii.pill,
        backgroundColor: colors.accentSoft,
    },
    followStateText: {
        color: colors.accentText,
        fontSize: 13,
    },
});

export { FAVOURITE_SIZE };
