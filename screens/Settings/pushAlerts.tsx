import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, ThemedSwitch } from '../../components/ui';
import { useTheme } from '../../services/themeContext';
import { useThemedStyles } from '../../services/theme/useThemedStyles';
import { useI18n } from '../../services/i18n/i18nContext';
import { useSettings } from '../../services/settingsContext';
import { PUSH_ALERT_TYPES } from '../../services/push';
import { SettingsHeader } from './header';
import { makeClearHelpStyles, makeStyles } from './styles';

const ICONS: Record<typeof PUSH_ALERT_TYPES[number], React.ComponentProps<typeof Ionicons>['name']> = {
    mention: 'at',
    status: 'notifications-outline',
    reblog: 'repeat',
    favourite: 'star-outline',
    follow: 'person-add-outline',
    follow_request: 'person-outline',
    poll: 'stats-chart-outline',
    update: 'create-outline',
    quote: 'chatbox-ellipses-outline',
};

// Settings → Push notification types: a switch per kind of notification
const PushAlerts: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { colors, type } = useTheme();
    const styles = useThemedStyles(makeStyles);
    const helpStyles = useThemedStyles(makeClearHelpStyles);
    const { t } = useI18n();
    const { pushAlerts, setPushAlert } = useSettings();

    return (
        <>
            <SettingsHeader title={t('push.title')} onBack={onBack} backLabel={t('push.back')} />
            <ScrollView contentContainerStyle={helpStyles.content} showsVerticalScrollIndicator={false}>
                <Text style={[type.body, helpStyles.intro]}>{t('push.intro')}</Text>
                <Card style={styles.group}>
                    {PUSH_ALERT_TYPES.map((alert, index) => (
                        <React.Fragment key={alert}>
                            {index > 0 && <View style={styles.divider} />}
                            <View style={styles.row}>
                                <Ionicons name={ICONS[alert]} size={20} color={colors.accentText} />
                                <Text style={[type.name, styles.rowLabel, styles.rowText]}>{t(`push.${alert}`)}</Text>
                                <ThemedSwitch value={pushAlerts[alert]} onValueChange={value => setPushAlert(alert, value)} accessibilityLabel={t(`push.${alert}`)} />
                            </View>
                        </React.Fragment>
                    ))}
                </Card>
                <View style={helpStyles.note} accessible>
                    <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
                    <Text style={[type.meta, helpStyles.noteText]}>{t('push.privacy')}</Text>
                </View>
            </ScrollView>
        </>
    );
};

export default PushAlerts;
