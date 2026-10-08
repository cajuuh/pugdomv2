import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../../services/authContext';
import { useSettings } from '../../services/settingsContext';
import { useTheme } from '../../services/themeContext';
import { getCoat } from '../../services/theme/coats';
import { useThemedStyles } from '../../services/theme/useThemedStyles';
import { Avatar, Card, IconButton, PugMark, SectionLabel, ThemedSwitch } from '../../components/ui';
import { appVersionLabel } from '../../services/appVersion';
import Appearance from './appearance';
import { SettingsHeader } from './header';
import { makeStyles } from './styles';
import { useI18n } from '../../services/i18n/i18nContext';
import { Language, LANGUAGES } from '../../services/i18n/defaults';
import { OptionSheet } from '../../components/ComposeModal/optionSheet';
import { useInstanceConfiguration } from '../../hooks/useInstanceConfiguration';
import { QuotePolicy, quotePolicies } from '../../services/mastodon/quotes';
import { updateDefaultQuotePolicy } from '../../services/mastodon/accounts';
import { dialog } from '../../services/dialog';

const PRIVACY_URL = 'https://github.com/cajuuh/pugdomv2/blob/main/PRIVACY.md';

interface SettingsProps {
    onBack: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onBack }) => {
    const { user, logout, savedAccounts, switchAccount, setAddingAccount, updateUser } = useAuth();
    const { colors, type, coat } = useTheme();
    const styles = useThemedStyles(makeStyles);
    const {
        notifications,
        setNotifications,
        mediaAutoplay,
        setMediaAutoplay,
        compactMode,
        setCompactMode,
        hideCounts,
        setHideCounts,
    } = useSettings();
    // Appearance is a second level inside Settings
    const [page, setPage] = useState<'main' | 'appearance'>('main');
    const { t, language, setLanguage, dict } = useI18n();
    const [languageSheetVisible, setLanguageSheetVisible] = useState(false);
    const [quoteSheetVisible, setQuoteSheetVisible] = useState(false);
    // Only servers with quote posts have a default for who can quote
    const { supportsQuotes } = useInstanceConfiguration(!!user);
    const i18n = useI18n();
    const quoteOptions = quotePolicies(i18n);
    const quotePolicy: QuotePolicy = user?.source?.quote_policy ?? 'public';
    const quotePolicyName = quoteOptions.find(option => option.value === quotePolicy)?.label ?? '';
    const changeQuotePolicy = async (policy: QuotePolicy) => {
        try {
            updateUser(await updateDefaultQuotePolicy(policy));
        } catch (error) {
            console.warn('Changing the default quote policy failed:', error);
            dialog.toast(t('quotes.policyFailed'));
        }
    };
    const coatName = t(`coats.${getCoat(coat).key}`);
    const languageName = dict.languageNames[language];

    if (page === 'appearance') {
        return (
            <SafeAreaView style={styles.safeArea}>
                <Appearance onBack={() => setPage('main')} />
            </SafeAreaView>
        );
    }

    const labelStyle = [type.name, styles.rowLabel];

    const switchRow = (icon: React.ComponentProps<typeof Ionicons>['name'], label: string, value: boolean, onChange: (value: boolean) => void) => (
        <View style={styles.row}>
            <Ionicons name={icon} size={20} color={colors.accentText} />
            <Text style={[labelStyle, styles.rowText]}>{label}</Text>
            <ThemedSwitch value={value} onValueChange={onChange} accessibilityLabel={label} />
        </View>
    );

    return (
        <SafeAreaView style={styles.safeArea}>
            <SettingsHeader title={t('settings.title')} onBack={onBack} backLabel={t('settings.close')} />

            <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
                <SectionLabel style={styles.sectionLabel}>{t('settings.accounts')}</SectionLabel>
                <Card style={styles.group}>
                    {savedAccounts.map(account => {
                        const isActive = user?.id === account.userInfo.id;
                        const name = account.userInfo.display_name || account.userInfo.username;
                        return (
                            <React.Fragment key={account.id}>
                                <Pressable
                                    style={styles.row}
                                    onPress={() => !isActive && switchAccount(account.id)}
                                    accessibilityRole="button"
                                    accessibilityLabel={isActive ? t('settings.currentAccount', { name }) : t('settings.switchTo', { name })}
                                >
                                    <Avatar name={name} uri={account.userInfo.avatar} size={40} />
                                    <View style={styles.rowText}>
                                        <Text style={labelStyle} numberOfLines={1}>{name}</Text>
                                        <Text style={[type.meta, styles.rowDetail]} numberOfLines={1}>
                                            @{account.userInfo.acct} • {account.instanceUrl.replace(/^https?:\/\//, '')}
                                        </Text>
                                    </View>
                                    {isActive ? (
                                        <Ionicons name="checkmark-circle" size={24} color={colors.accentText} />
                                    ) : (
                                        <IconButton
                                            icon="log-out-outline"
                                            size={20}
                                            color={colors.dangerColor}
                                            accessibilityLabel={t('settings.logOutOf', { name })}
                                            onPress={() => logout(account.id)}
                                        />
                                    )}
                                </Pressable>
                                <View style={styles.divider} />
                            </React.Fragment>
                        );
                    })}
                    <Pressable style={[styles.row, styles.rowCentered]} onPress={() => setAddingAccount(true)} accessibilityRole="button">
                        <Ionicons name="add-circle-outline" size={20} color={colors.accentText} />
                        <Text style={[type.name, styles.rowLabel, { color: colors.accentText }]}>{t('settings.addAccount')}</Text>
                    </Pressable>
                </Card>

                <SectionLabel style={styles.sectionLabel}>{t('settings.preferences')}</SectionLabel>
                <Card style={styles.group}>
                    <Pressable
                        style={styles.row}
                        onPress={() => setPage('appearance')}
                        accessibilityRole="button"
                        accessibilityLabel={t('settings.appearanceLabel', { coat: coatName })}
                    >
                        <Ionicons name="color-palette-outline" size={20} color={colors.accentText} />
                        <Text style={[labelStyle, styles.rowText]}>{t('settings.appearance')}</Text>
                        <View style={styles.rowTrailing}>
                            <PugMark coat={coat} size={22} />
                            <Text style={[type.meta, styles.rowValue]}>{coatName}</Text>
                            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                        </View>
                    </Pressable>
                    <View style={styles.divider} />
                    <Pressable
                        style={styles.row}
                        onPress={() => setLanguageSheetVisible(true)}
                        accessibilityRole="button"
                        accessibilityLabel={t('settings.languageLabel', { value: languageName })}
                    >
                        <Ionicons name="language-outline" size={20} color={colors.accentText} />
                        <Text style={[labelStyle, styles.rowText]}>{t('settings.language')}</Text>
                        <View style={styles.rowTrailing}>
                            <Text style={[type.meta, styles.rowValue]}>{languageName}</Text>
                            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                        </View>
                    </Pressable>
                    {supportsQuotes && (
                        <>
                            <View style={styles.divider} />
                            <Pressable
                                style={styles.row}
                                onPress={() => setQuoteSheetVisible(true)}
                                accessibilityRole="button"
                                accessibilityLabel={t('settings.quotePolicyLabel', { value: quotePolicyName })}
                            >
                                <Ionicons name="chatbox-ellipses-outline" size={20} color={colors.accentText} />
                                <Text style={[labelStyle, styles.rowText]}>{t('settings.quotePolicy')}</Text>
                                <View style={styles.rowTrailing}>
                                    <Text style={[type.meta, styles.rowValue]}>{quotePolicyName}</Text>
                                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                                </View>
                            </Pressable>
                        </>
                    )}
                    <View style={styles.divider} />
                    {switchRow('notifications-outline', t('settings.pushNotifications'), notifications, setNotifications)}
                    <View style={styles.divider} />
                    {switchRow('play-circle-outline', t('settings.autoplay'), mediaAutoplay, setMediaAutoplay)}
                    <View style={styles.divider} />
                    {switchRow('list-outline', t('settings.compactMode'), compactMode, setCompactMode)}
                    <View style={styles.divider} />
                    {switchRow('stats-chart-outline', t('settings.hideCounts'), hideCounts, setHideCounts)}
                </Card>

                <SectionLabel style={styles.sectionLabel}>{t('settings.about')}</SectionLabel>
                <Card style={styles.group}>
                    <View style={styles.row}>
                        <Ionicons name="information-circle-outline" size={20} color={colors.accentText} />
                        <Text style={[labelStyle, styles.rowText]}>{t('settings.version')}</Text>
                        <Text style={[type.meta, styles.rowValue]}>{appVersionLabel()}</Text>
                    </View>
                    <View style={styles.divider} />
                    <Pressable
                        style={styles.row}
                        onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL).catch(error => console.error('Failed to open privacy policy:', error))}
                        accessibilityRole="link"
                    >
                        <Ionicons name="shield-checkmark-outline" size={20} color={colors.accentText} />
                        <Text style={[labelStyle, styles.rowText]}>{t('settings.privacy')}</Text>
                        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                    </Pressable>
                </Card>

                <Pressable style={styles.logoutButton} onPress={() => logout()} accessibilityRole="button">
                    <Ionicons name="log-out-outline" size={18} color={colors.dangerColor} />
                    <Text style={[type.name, styles.logoutLabel]}>{t('common.logOut')}</Text>
                </Pressable>
            </ScrollView>

            <OptionSheet<QuotePolicy>
                visible={quoteSheetVisible}
                title={t('settings.quotePolicy')}
                options={quoteOptions}
                value={quotePolicy}
                onSelect={changeQuotePolicy}
                onClose={() => setQuoteSheetVisible(false)}
            />
            <OptionSheet<Language>
                visible={languageSheetVisible}
                title={t('settings.language')}
                options={LANGUAGES.map(value => ({ value, label: dict.languageNames[value] }))}
                value={language}
                onSelect={setLanguage}
                onClose={() => setLanguageSheetVisible(false)}
            />
        </SafeAreaView>
    );
};

export default Settings;
