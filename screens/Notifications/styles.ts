import { StyleSheet } from 'react-native';
import { ThemeColors } from '../../services/themeContext';
import { TAB_BAR_CLEARANCE } from '../../components/TabBar/styles';
import { radii, space } from '../../services/theme/shape';

const ROW_PADDING = space.lg;
const AVATAR_SIZE = 44;
const UNREAD_DOT = 8;
const ROW_GAP = space.md;
const FAVOURITE_SIZE = 34;
const STACKED_AVATAR = 30;
const THUMBNAIL_SIZE = 72;

export const makeStyles = (colors: ThemeColors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: space.md,
        paddingTop: 6,
        paddingLeft: 20,
        paddingRight: space.lg,
    },
    title: {
        flexShrink: 1,
        color: colors.textPrimary,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
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
        // Set here so segmentFirst/Last only change them, never unset them: on Android an unset border
        // width is NaN, which on a card that's still rounded clips the whole row away (a lone "New" row
        // turned blank when Mark all as read took its bottom border and corners but left the top ones)
        borderTopWidth: 0,
        borderBottomWidth: 0,
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
    // A new row's dot, in the padding left of the avatar, level with its middle
    unreadDot: {
        position: 'absolute',
        left: (ROW_PADDING - UNREAD_DOT) / 2,
        top: 14 + AVATAR_SIZE / 2 - UNREAD_DOT / 2,
        width: UNREAD_DOT,
        height: UNREAD_DOT,
        borderRadius: UNREAD_DOT / 2,
        backgroundColor: colors.accentColor,
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
    // A swiped row covers the Remove action behind it
    swipeCell: {
        overflow: 'hidden',
    },
    swipeRow: {
        backgroundColor: colors.cardBackground,
    },
    removeAction: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        paddingLeft: ROW_PADDING,
        backgroundColor: colors.dangerColor,
    },
    removeText: {
        color: colors.cardBackground,
    },
    selectable: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: ROW_PADDING,
    },
    selectableOn: {
        backgroundColor: colors.accentSoft,
    },
    selectableContent: {
        flex: 1,
    },
    stack44: {
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
    },
    // Each stacked avatar gets a surface-colored ring so the overlap reads as two faces
    stacked: {
        position: 'absolute',
        padding: 2,
        margin: -2,
        borderRadius: radii.pill,
        backgroundColor: colors.cardBackground,
    },
    stackedBack: {
        left: 0,
        top: 0,
    },
    stackedFront: {
        right: 0,
        bottom: 0,
    },
    content: {
        flex: 1,
        minWidth: 0,
        gap: 6,
    },
    stack: {
        gap: 6,
    },
    requestActions: {
        flexDirection: 'row',
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
    thumbnails: {
        flexDirection: 'row',
        gap: space.xs,
        marginTop: space.xs,
    },
    thumbnail: {
        width: THUMBNAIL_SIZE,
        height: THUMBNAIL_SIZE,
        borderRadius: radii.input / 2,
        overflow: 'hidden',
        backgroundColor: colors.inputBackground,
    },
    thumbnailImage: {
        width: '100%',
        height: '100%',
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
});

export { FAVOURITE_SIZE, STACKED_AVATAR };
