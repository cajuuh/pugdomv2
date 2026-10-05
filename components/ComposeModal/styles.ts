import { StyleSheet } from 'react-native';
import { ThemeColors } from '../../services/themeContext';
import { MIN_TOUCH, radii, space } from '../../services/theme/shape';

export const PILL_HEIGHT = 30;
export const EMOJI_CELL = 44;

export const makeStyles = (colors: ThemeColors) => StyleSheet.create({
    root: {
        flex: 1,
    },
    keyboardAvoider: {
        flex: 1,
    },
    sheet: {
        flex: 1,
        borderTopLeftRadius: radii.sheet,
        borderTopRightRadius: radii.sheet,
        backgroundColor: colors.cardBackground,
        shadowColor: colors.shadowColor,
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.12,
        shadowRadius: 30,
        elevation: 12,
    },
    grabberRow: {
        alignItems: 'center',
        paddingTop: space.sm,
    },
    grabber: {
        width: 38,
        height: 5,
        borderRadius: radii.pill,
        backgroundColor: colors.borderColor,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: space.sm,
        paddingHorizontal: space.lg,
    },
    // Keeps the title centered whatever the button widths
    headerSide: {
        flex: 1,
        flexDirection: 'row',
    },
    headerSideEnd: {
        justifyContent: 'flex-end',
    },
    // The sides share what the title leaves, so titles stay short (one line) to leave room for the buttons
    headerTitle: {
        color: colors.textPrimary,
    },
    cancel: {
        paddingHorizontal: 6,
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingTop: space.lg,
        paddingBottom: space.xl,
        gap: 14,
    },
    replyWell: {
        marginHorizontal: space.lg,
        gap: 6,
    },
    replyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
    },
    replyNames: {
        flex: 1,
        minWidth: 0,
    },
    replyName: {
        color: colors.textPrimary,
        fontSize: 13,
        lineHeight: 17,
    },
    replyHandle: {
        color: colors.textMuted,
        fontSize: 12,
        lineHeight: 16,
    },
    replyContent: {
        color: colors.textSecondary,
        fontSize: 13.5,
        lineHeight: 19,
    },
    author: {
        flexDirection: 'row',
        gap: space.md,
        paddingHorizontal: 20,
    },
    authorDetails: {
        flex: 1,
        minWidth: 0,
        gap: 6,
    },
    authorName: {
        color: colors.textPrimary,
    },
    pills: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    pill: {
        height: PILL_HEIGHT,
        paddingHorizontal: 10,
        borderRadius: radii.pill,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: colors.inputBackground,
    },
    pillText: {
        color: colors.textSecondary,
        fontSize: 12.5,
        lineHeight: 16,
    },
    contentWarning: {
        marginHorizontal: space.lg,
        minHeight: MIN_TOUCH,
        paddingHorizontal: 14,
        borderRadius: radii.input,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        backgroundColor: colors.accentSoft,
    },
    contentWarningInput: {
        flex: 1,
        minHeight: MIN_TOUCH,
        paddingVertical: 0,
        color: colors.textPrimary,
        fontSize: 15,
    },
    textArea: {
        minHeight: 120,
        paddingHorizontal: 20,
        paddingVertical: 0,
        color: colors.textPrimary,
        fontSize: 17,
        lineHeight: 24.5,
        textAlignVertical: 'top',
    },
    toolbar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        paddingTop: 10,
        paddingHorizontal: space.md,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.borderColor,
    },
    tool: {
        borderRadius: radii.input,
    },
    toolActive: {
        backgroundColor: colors.accentSoft,
    },
    quoteNote: {
        marginHorizontal: 20,
        color: colors.textMuted,
    },
    // The quoted post under the text, with its ✕ over the corner
    quote: {
        marginHorizontal: space.lg,
    },
    quoteRemove: {
        position: 'absolute',
        top: 0,
        right: -space.sm,
    },
    // Kept mounted but out of the way (the post while describing an image)
    hidden: {
        display: 'none',
    },
    toolbarSpacer: {
        flex: 1,
    },
    counter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        paddingRight: space.xs,
    },
    counterText: {
        fontSize: 13,
    },

    /* Poll editor */
    poll: {
        marginHorizontal: space.lg,
        padding: space.md,
        gap: space.sm,
    },
    pollHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: space.xs,
    },
    pollRemove: {
        minWidth: 32,
        minHeight: 32,
    },
    choiceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
    },
    choice: {
        flex: 1,
        height: MIN_TOUCH,
        paddingHorizontal: 14,
        borderRadius: radii.input,
        borderWidth: 1.5,
        borderColor: colors.borderColor,
        backgroundColor: colors.cardBackground,
        color: colors.textPrimary,
        fontSize: 15,
    },
    // Thicker border without moving the text: 0.5pt less padding for the 0.5pt more border
    choiceFocused: {
        borderWidth: 2,
        paddingHorizontal: 13.5,
        borderColor: colors.accentColor,
    },
    addChoice: {
        height: MIN_TOUCH,
        borderRadius: radii.input,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: colors.borderColor,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    addChoiceText: {
        color: colors.accentText,
        fontSize: 14,
    },
    pollError: {
        color: colors.dangerColor,
        paddingHorizontal: space.xs,
    },
    pollFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: space.sm,
        paddingTop: space.xs,
        paddingHorizontal: 2,
    },
    duration: {
        height: 34,
        paddingHorizontal: space.md,
        borderRadius: radii.pill,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.borderColor,
        backgroundColor: colors.cardBackground,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    durationText: {
        color: colors.textPrimary,
        fontSize: 13,
    },
    multiple: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
    },
    multipleText: {
        color: colors.textSecondary,
        fontSize: 13,
    },

    /* Bottom sheets (visibility, language, poll length, emoji) */
    sheetRoot: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    sheetBackdrop: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        backgroundColor: colors.scrim,
    },
    pickerSheet: {
        maxHeight: '75%',
        paddingHorizontal: space.lg,
        borderTopLeftRadius: radii.sheet,
        borderTopRightRadius: radii.sheet,
        backgroundColor: colors.cardBackground,
    },
    pickerTitle: {
        color: colors.textPrimary,
        paddingTop: space.md,
        paddingBottom: space.sm,
        paddingHorizontal: space.xs,
    },
    pickerTitleWithSubtitle: {
        paddingBottom: 2,
    },
    pickerSubtitle: {
        color: colors.textMuted,
        paddingBottom: space.sm,
        paddingHorizontal: space.xs,
    },
    option: {
        minHeight: 52,
        paddingVertical: 10,
        paddingHorizontal: space.md,
        borderRadius: radii.input,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
    },
    optionSelected: {
        backgroundColor: colors.accentSoft,
    },
    optionText: {
        flex: 1,
        gap: 1,
    },
    optionLabel: {
        color: colors.textPrimary,
    },
    optionDescription: {
        color: colors.textMuted,
    },
    emojiGrid: {
        height: 320,
    },
    emojiChips: {
        paddingBottom: space.sm,
        paddingHorizontal: space.xs,
    },
    emojiSectionTitle: {
        color: colors.textMuted,
        paddingTop: space.sm,
        paddingBottom: space.xs,
        paddingHorizontal: space.xs,
        backgroundColor: colors.cardBackground,
    },
    emojiRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    emojiCell: {
        width: EMOJI_CELL,
        height: EMOJI_CELL,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.input,
    },
    emojiImage: {
        width: 28,
        height: 28,
    },
    emojiStatus: {
        height: 120,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emojiStatusText: {
        color: colors.textMuted,
    },
});
