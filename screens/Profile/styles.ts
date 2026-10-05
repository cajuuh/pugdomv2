import { StyleSheet } from 'react-native';
import { ThemeColors } from '../../services/themeContext';
import { TAB_BAR_CLEARANCE } from '../../components/TabBar/styles';
import { radii, space } from '../../services/theme/shape';

export const AVATAR_SIZE = 88;
export const SHARE_SIZE = 38;
export const BANNER_HEIGHT = 168;
const RING = 5;

export const makeStyles = (colors: ThemeColors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    listContent: {
        paddingBottom: TAB_BAR_CLEARANCE,
    },
    header: {
        marginBottom: space.md,
    },
    banner: {
        height: BANNER_HEIGHT,
        overflow: 'hidden',
        backgroundColor: colors.accentSoft,
    },
    bannerImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    // A large, faint pug in the coat's colors when there's no header image
    bannerMark: {
        position: 'absolute',
        right: -36,
        top: 10,
        opacity: 0.35,
    },
    bannerButton: {
        position: 'absolute',
        right: space.lg,
        top: space.md,
        borderRadius: radii.pill,
        backgroundColor: colors.cardBackground,
        shadowColor: colors.shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 2,
    },
    info: {
        paddingHorizontal: 20,
        gap: space.md,
    },
    bannerButtonLeft: {
        right: undefined,
        left: space.lg,
    },
    // "Follows you" and the link to a remote profile, under the handle
    otherInfo: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: space.sm,
        marginTop: space.sm,
    },
    followsYou: {
        paddingVertical: 3,
        paddingHorizontal: space.sm,
        borderRadius: radii.pill,
        backgroundColor: colors.accentSoft,
    },
    followsYouText: {
        fontSize: 10.5,
        color: colors.accentText,
    },
    remoteLink: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
    },
    remoteLinkText: {
        color: colors.accentText,
    },
    avatarRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        marginTop: -(AVATAR_SIZE / 2),
    },
    // The ground color around the avatar cuts it out of the banner
    avatarRing: {
        padding: RING,
        margin: -RING,
        borderRadius: radii.pill,
        backgroundColor: colors.background,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        paddingBottom: space.xs,
    },
    share: {
        width: SHARE_SIZE,
        height: SHARE_SIZE,
        borderRadius: SHARE_SIZE / 2,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.borderColor,
        backgroundColor: colors.cardBackground,
        alignItems: 'center',
        justifyContent: 'center',
    },
    names: {
        gap: 2,
    },
    name: {
        color: colors.textPrimary,
        fontSize: 26,
        lineHeight: 32,
    },
    handle: {
        color: colors.textMuted,
        fontSize: 14,
        lineHeight: 19,
    },
    stats: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        columnGap: 18,
        rowGap: space.xs,
    },
    stat: {
        color: colors.textMuted,
        fontSize: 14,
        lineHeight: 19,
    },
    statNumber: {
        color: colors.textPrimary,
        fontSize: 14,
        lineHeight: 19,
    },
    tabs: {
        marginTop: 18,
    },
    empty: {
        alignItems: 'center',
        padding: 40,
    },
    emptyText: {
        color: colors.textSecondary,
    },
    footer: {
        paddingVertical: 20,
    },
});
