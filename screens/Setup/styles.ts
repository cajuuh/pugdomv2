import { StyleSheet } from 'react-native';
import { ThemeColors } from '../../services/themeContext';
import { radii, space } from '../../services/theme/shape';

export const makeStyles = (colors: ThemeColors) => StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: space.xl,
        backgroundColor: colors.background,
    },
    title: {
        marginTop: space.lg,
        color: colors.textPrimary,
        textAlign: 'center',
    },
    server: {
        marginTop: space.xs,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    message: {
        marginTop: space.xl,
        minHeight: 22,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    track: {
        alignSelf: 'stretch',
        height: 6,
        marginTop: space.md,
        borderRadius: radii.pill,
        overflow: 'hidden',
        backgroundColor: colors.inputBackground,
    },
    fill: {
        height: '100%',
        borderRadius: radii.pill,
        backgroundColor: colors.accentColor,
    },
    skip: {
        marginTop: space.xl,
    },
});
