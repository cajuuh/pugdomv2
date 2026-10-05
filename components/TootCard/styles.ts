import { StyleSheet } from 'react-native';
import { ThemeColors } from '../../services/themeContext';
import { radii, space } from '../../services/theme/shape';

export const CARD_MARGIN = 16;
export const CARD_PADDING = 16;
export const THREAD_AVATAR_GAP = 10;
// Compact Mode: list rows with an avatar column, smaller media and a slimmer action row
export const COMPACT_AVATAR = 32;
export const COMPACT_PADDING = 12;
export const COMPACT_ACTION_HEIGHT = 32;
export const COMPACT_ACTION_ICON = 18;

export const makeStyles = (colors: ThemeColors) => StyleSheet.create({
    card: {
        marginHorizontal: CARD_MARGIN,
        marginBottom: space.md,
        paddingTop: 14,
        paddingHorizontal: CARD_PADDING,
        paddingBottom: 6,
    },
    // Compact posts read as a list: full width, no card chrome, a hairline between posts
    cardCompact: {
        marginHorizontal: 0,
        marginBottom: 0,
        paddingTop: 10,
        paddingHorizontal: COMPACT_PADDING,
        paddingBottom: 2,
        borderWidth: 0,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderRadius: 0,
        shadowOpacity: 0,
        elevation: 0,
    },
    boostRowCompact: {
        marginBottom: 6,
    },
    // Display name and handle share one line
    namesInline: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 4,
    },
    handleInline: {
        flexShrink: 1,
    },
    contentCompact: {
        marginTop: 2,
        gap: space.sm,
    },
    singleMediaCompact: {
        height: 140,
    },
    gridMediaCompact: {
        height: 80,
    },
    linkPlainCompact: {
        paddingVertical: space.sm,
        paddingHorizontal: 10,
    },
    actionRowCompact: {
        marginTop: 2,
    },
    actionButtonCompact: {
        minHeight: COMPACT_ACTION_HEIGHT,
    },
    // In a thread the card sits inside the thread's own container
    cardThread: {
        marginHorizontal: 0,
        marginBottom: 0,
        borderWidth: 0,
        borderRadius: 0,
        backgroundColor: 'transparent',
        shadowOpacity: 0,
        elevation: 0,
    },
    boostRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 10,
        marginLeft: 2,
    },
    boostText: {
        flexShrink: 1,
        color: colors.textMuted,
    },
    authorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    names: {
        flex: 1,
        minWidth: 0,
    },
    displayName: {
        color: colors.textPrimary,
    },
    handle: {
        fontSize: 13,
        color: colors.textMuted,
    },
    time: {
        color: colors.textMuted,
    },
    threadRow: {
        flexDirection: 'row',
    },
    threadAvatarColumn: {
        alignItems: 'center',
        marginRight: THREAD_AVATAR_GAP,
    },
    threadLine: {
        position: 'absolute',
        width: 2,
        backgroundColor: colors.borderColor,
        zIndex: -1,
    },
    threadBody: {
        flex: 1,
        minWidth: 0,
    },
    content: {
        marginTop: 10,
        gap: space.md,
    },
    // Content warning, collapsed
    cwRibbon: {
        marginTop: space.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: space.md,
        paddingRight: space.md,
        paddingLeft: 14,
        borderRadius: radii.well,
        backgroundColor: colors.accentSoft,
    },
    cwText: {
        flex: 1,
        gap: 1,
    },
    cwLabel: {
        fontSize: 11,
        color: colors.accentText,
    },
    cwSpoiler: {
        fontSize: 14.5,
        color: colors.textPrimary,
    },
    cwHidden: {
        color: colors.textSecondary,
    },
    // Content warning, opened: the hidden content sits inside a dashed frame
    cwFrame: {
        marginTop: space.md,
        gap: space.sm,
        paddingTop: 10,
        paddingRight: space.md,
        paddingBottom: space.md,
        paddingLeft: 14,
        borderRadius: radii.well,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: colors.accentColor,
    },
    cwFrameHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
    },
    cwFrameTitle: {
        flex: 1,
        fontSize: 13,
        color: colors.accentText,
    },
    cwFrameContent: {
        gap: space.md,
    },
    mediaFrame: {
        borderRadius: radii.well,
        overflow: 'hidden',
    },
    singleMedia: {
        width: '100%',
        height: 200,
        borderRadius: radii.well,
        overflow: 'hidden',
        backgroundColor: colors.inputBackground,
    },
    mediaImage: {
        width: '100%',
        height: '100%',
    },
    mediaGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: space.sm,
    },
    gridMedia: {
        height: 120,
        borderRadius: space.md,
        overflow: 'hidden',
        backgroundColor: colors.inputBackground,
    },
    veil: {
        ...StyleSheet.absoluteFill,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: colors.veil,
    },
    veilLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    veilText: {
        fontSize: 12.5,
        color: colors.textPrimary,
    },
    altChip: {
        position: 'absolute',
        left: space.sm,
        bottom: space.sm,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: radii.pill,
        backgroundColor: colors.veilStrong,
    },
    altChipText: {
        fontSize: 10,
        color: colors.textPrimary,
    },
    descriptionText: {
        color: colors.textPrimary,
        paddingHorizontal: space.xs,
        paddingBottom: space.md,
    },
    hideMediaChip: {
        position: 'absolute',
        left: space.sm,
        top: space.sm,
        width: 32,
        height: 32,
        borderRadius: radii.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.veilStrong,
    },
    linkPreview: {
        flexDirection: 'row',
        alignItems: 'stretch',
        borderRadius: radii.well,
        overflow: 'hidden',
        backgroundColor: colors.inputBackground,
    },
    linkThumb: {
        width: 88,
        minHeight: 88,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.accentSoft,
    },
    linkBody: {
        flex: 1,
        minWidth: 0,
        gap: 3,
        paddingVertical: 11,
        paddingHorizontal: space.md,
    },
    linkProvider: {
        fontSize: 11,
        color: colors.accentText,
    },
    linkTitle: {
        fontSize: 14,
        lineHeight: 18,
        color: colors.textPrimary,
    },
    linkMeta: {
        color: colors.textMuted,
    },
    linkPlain: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: space.md,
        paddingHorizontal: 14,
        borderRadius: radii.well,
        backgroundColor: colors.inputBackground,
    },
    linkIconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.cardBackground,
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 6,
    },
    actionButton: {
        minWidth: 44,
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: space.sm,
    },
    actionCount: {
        fontSize: 13,
        color: colors.textMuted,
    },
    actionCountActive: {
        color: colors.accentText,
    },
});
