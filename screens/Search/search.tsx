import { StyleSheet, Text, View } from 'react-native';
import { PugMark } from '../../components/ui';
import { space } from '../../services/theme/shape';
import { useTheme } from '../../services/themeContext';
import { useI18n } from '../../services/i18n/i18nContext';

export default function Search() {
    const { colors ,type,coat} = useTheme();
    const { t } = useI18n();

    return (
    <View
        style={[
            styles.container,
            { backgroundColor: colors.background },
        ]}
    >
        <PugMark coat={coat} size={80} />

        <Text
            style={[
                type.title,
                styles.title,
                { color: colors.textPrimary },
            ]}
        >
            {t('search.comingSoon')}
        </Text>
    </View>
);
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: space.xl,
    },

    title: {
        marginTop: space.lg,
        textAlign: 'center',
    },
});