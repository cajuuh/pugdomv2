import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card } from '../../components/ui';
import { useTheme } from '../../services/themeContext';
import { useThemedStyles } from '../../services/theme/useThemedStyles';
import { useI18n } from '../../services/i18n/i18nContext';
import { TKey } from '../../services/i18n/translate';
import { SettingsHeader } from './header';
import { makeClearHelpStyles } from './styles';

// The three ways to remove notifications, as on the Notifications screen
const WAYS: { icon: React.ComponentProps<typeof Ionicons>['name']; title: TKey; text: TKey }[] = [
    { icon: 'arrow-forward-circle-outline', title: 'clearHelp.swipeTitle', text: 'clearHelp.swipeText' },
    { icon: 'checkmark-circle-outline', title: 'clearHelp.selectTitle', text: 'clearHelp.selectText' },
    { icon: 'trash-outline', title: 'clearHelp.allTitle', text: 'clearHelp.allText' },
];

// Settings → Clear notifications: how to remove notifications, and what removing means
const ClearNotificationsHelp: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { colors, type } = useTheme();
    const styles = useThemedStyles(makeClearHelpStyles);
    const { t } = useI18n();

    return (
        <>
            <SettingsHeader title={t('clearHelp.title')} onBack={onBack} backLabel={t('clearHelp.back')} />
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={[type.body, styles.intro]}>{t('clearHelp.intro')}</Text>
                {WAYS.map(way => (
                    <Card key={way.title} style={styles.way} accessible accessibilityLabel={`${t(way.title)}. ${t(way.text)}`}>
                        <View style={styles.icon}>
                            <Ionicons name={way.icon} size={22} color={colors.accentText} />
                        </View>
                        <View style={styles.wayText}>
                            <Text style={[type.name, styles.wayTitle]}>{t(way.title)}</Text>
                            <Text style={[type.body, styles.wayBody]}>{t(way.text)}</Text>
                        </View>
                    </Card>
                ))}
                <View style={styles.note} accessible>
                    <Ionicons name="alert-circle-outline" size={18} color={colors.textMuted} />
                    <Text style={[type.meta, styles.noteText]}>{t('clearHelp.note')}</Text>
                </View>
            </ScrollView>
        </>
    );
};

export default ClearNotificationsHelp;
