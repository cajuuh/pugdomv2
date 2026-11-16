import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../services/themeContext';
import { useI18n } from '../../services/i18n/i18nContext';
import { TKey } from '../../services/i18n/translate';
import { dialog } from '../../services/dialog';
import {
    NotificationPolicy,
    notificationPolicyKey,
    POLICY_KEYS,
    PolicyKey,
    PolicyValue,
    updateNotificationPolicy,
} from '../../services/mastodon/notificationRequests';
import { Card, Icon, IconButton } from '../../components/ui';
import { OptionSheet } from '../../components/ComposeModal/optionSheet';
import { useNotificationPolicy } from '../../hooks/useNotificationRequests';
import { space } from '../../services/theme/shape';
import { styles } from './notificationRequests';

const CATEGORY: Record<PolicyKey, { label: TKey; hint?: TKey }> = {
    for_not_following: { label: 'filteredNotifications.notFollowing' },
    for_not_followers: { label: 'filteredNotifications.notFollowers' },
    for_new_accounts: { label: 'filteredNotifications.newAccounts', hint: 'filteredNotifications.newAccountsHint' },
    for_private_mentions: { label: 'filteredNotifications.privateMentions', hint: 'filteredNotifications.privateMentionsHint' },
    for_limited_accounts: { label: 'filteredNotifications.limitedAccounts' },
};

const VALUE: Record<PolicyValue, { label: TKey; hint: TKey; icon: 'notifications-outline' | 'options-outline' | 'eye-off-outline' }> = {
    accept: { label: 'filteredNotifications.valueAccept', hint: 'filteredNotifications.valueAcceptHint', icon: 'notifications-outline' },
    filter: { label: 'filteredNotifications.valueFilter', hint: 'filteredNotifications.valueFilterHint', icon: 'options-outline' },
    drop: { label: 'filteredNotifications.valueDrop', hint: 'filteredNotifications.valueDropHint', icon: 'eye-off-outline' },
};

// The notification policy: for each kind of account, show, filter (hold as a request) or ignore
const NotificationPolicyScreen = ({ onBack }: { onBack: () => void }) => {
    const { colors, type } = useTheme();
    const { t } = useI18n();
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();
    const { data: policy, isLoading } = useNotificationPolicy();
    const [editing, setEditing] = useState<PolicyKey | null>(null);

    const change = async (key: PolicyKey, value: PolicyValue) => {
        const previous = queryClient.getQueryData<NotificationPolicy | null>(notificationPolicyKey);
        queryClient.setQueryData<NotificationPolicy | null>(notificationPolicyKey, current => current && { ...current, [key]: value });
        try {
            const saved = await updateNotificationPolicy({ [key]: value });
            // Some servers answer without the summary; keep the one we have
            queryClient.setQueryData<NotificationPolicy | null>(notificationPolicyKey, current => (saved?.summary ? saved : current));
        } catch (error) {
            console.warn('Saving the notification policy failed:', error);
            queryClient.setQueryData(notificationPolicyKey, previous);
            dialog.toast(t('filteredNotifications.saveFailed'));
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.borderColor, backgroundColor: colors.cardBackground }]}>
                <IconButton icon="arrow-back" accessibilityLabel={t('common.goBack')} onPress={onBack} />
                <Text accessibilityRole="header" style={[type.name, styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                    {t('filteredNotifications.rulesTitle')}
                </Text>
                <View style={{ width: 44 }} />
            </View>
            {isLoading || !policy ? (
                <ActivityIndicator style={styles.loading} color={colors.accentColor} />
            ) : (
                <ScrollView contentContainerStyle={styles.list}>
                    <Text style={[type.meta, styles.intro, { color: colors.textMuted }]}>{t('filteredNotifications.rulesIntro')}</Text>
                    <Card style={[styles.card, { paddingBottom: 0 }]}>
                        {POLICY_KEYS.map((key, index) => {
                            const label = t(CATEGORY[key].label);
                            const value = t(VALUE[policy[key]].label);
                            return (
                                <Pressable
                                    key={key}
                                    testID={`policy-${key}`}
                                    onPress={() => setEditing(key)}
                                    accessibilityRole="button"
                                    accessibilityLabel={`${label}: ${value}`}
                                    style={({ pressed }) => [
                                        { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
                                        index > 0 && { borderTopWidth: 1, borderTopColor: colors.borderColor },
                                        pressed && { opacity: 0.7 },
                                    ]}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text style={[type.body, { color: colors.textPrimary }]}>{label}</Text>
                                        {CATEGORY[key].hint && <Text style={[type.meta, { color: colors.textMuted }]}>{t(CATEGORY[key].hint!)}</Text>}
                                    </View>
                                    <Text style={[type.body, { color: colors.textMuted }]}>{value}</Text>
                                    <Icon name="chevron-forward" size={16} color={colors.textMuted} />
                                </Pressable>
                            );
                        })}
                    </Card>
                </ScrollView>
            )}
            {editing && policy && (
                <OptionSheet<PolicyValue>
                    visible
                    title={t(CATEGORY[editing].label)}
                    options={(Object.keys(VALUE) as PolicyValue[]).map(value => ({ value, label: t(VALUE[value].label), description: t(VALUE[value].hint), icon: VALUE[value].icon }))}
                    value={policy[editing]}
                    onSelect={value => change(editing, value)}
                    onClose={() => setEditing(null)}
                />
            )}
        </View>
    );
};

export default NotificationPolicyScreen;
