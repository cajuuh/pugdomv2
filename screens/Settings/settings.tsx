import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
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

interface SettingsProps {
    onBack: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onBack }) => {
    const { user, logout, savedAccounts, switchAccount, setAddingAccount } = useAuth();
    const { colors, type, coat } = useTheme();
    const styles = useThemedStyles(makeStyles);
    const {
        notifications,
        setNotifications,
        mediaAutoplay,
        setMediaAutoplay,
        compactMode,
        setCompactMode,
    } = useSettings();
    // Appearance is a second level inside Settings
    const [page, setPage] = useState<'main' | 'appearance'>('main');

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
            <SettingsHeader title="Settings" onBack={onBack} backLabel="Close settings" />

            <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
                <SectionLabel style={styles.sectionLabel}>Accounts</SectionLabel>
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
                                    accessibilityLabel={isActive ? `${name}, current account` : `Switch to ${name}`}
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
                                            accessibilityLabel={`Log out of ${name}`}
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
                        <Text style={[type.name, styles.rowLabel, { color: colors.accentText }]}>Add Account</Text>
                    </Pressable>
                </Card>

                <SectionLabel style={styles.sectionLabel}>Preferences</SectionLabel>
                <Card style={styles.group}>
                    <Pressable
                        style={styles.row}
                        onPress={() => setPage('appearance')}
                        accessibilityRole="button"
                        accessibilityLabel={`Appearance, ${getCoat(coat).name}`}
                    >
                        <Ionicons name="color-palette-outline" size={20} color={colors.accentText} />
                        <Text style={[labelStyle, styles.rowText]}>Appearance</Text>
                        <View style={styles.rowTrailing}>
                            <PugMark coat={coat} size={22} />
                            <Text style={[type.meta, styles.rowValue]}>{getCoat(coat).name}</Text>
                            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                        </View>
                    </Pressable>
                    <View style={styles.divider} />
                    {switchRow('notifications-outline', 'Push Notifications', notifications, setNotifications)}
                    <View style={styles.divider} />
                    {switchRow('play-circle-outline', 'Autoplay Media', mediaAutoplay, setMediaAutoplay)}
                    <View style={styles.divider} />
                    {switchRow('list-outline', 'Compact Mode', compactMode, setCompactMode)}
                </Card>

                <SectionLabel style={styles.sectionLabel}>About</SectionLabel>
                <Card style={styles.group}>
                    <View style={styles.row}>
                        <Ionicons name="information-circle-outline" size={20} color={colors.accentText} />
                        <Text style={[labelStyle, styles.rowText]}>App Version</Text>
                        <Text style={[type.meta, styles.rowValue]}>{appVersionLabel()}</Text>
                    </View>
                    <View style={styles.divider} />
                    <Pressable style={styles.row} accessibilityRole="button">
                        <Ionicons name="shield-checkmark-outline" size={20} color={colors.accentText} />
                        <Text style={[labelStyle, styles.rowText]}>Privacy Policy</Text>
                        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                    </Pressable>
                </Card>

                <Pressable style={styles.logoutButton} onPress={() => logout()} accessibilityRole="button">
                    <Ionicons name="log-out-outline" size={18} color={colors.dangerColor} />
                    <Text style={[type.name, styles.logoutLabel]}>Log Out</Text>
                </Pressable>
            </ScrollView>
        </SafeAreaView>
    );
};

export default Settings;
