import React from 'react';
import { StyleSheet, ScrollView, Switch, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, Avatar, Button, Card } from 'react-native-ui-lib';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../../services/authContext';
import { useSettings } from '../../services/settingsContext';
import { useTheme } from '../../services/themeContext';
import { styles } from './styles';

interface SettingsProps {
    onBack: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onBack }) => {
    const { user, logout, savedAccounts, switchAccount, setAddingAccount } = useAuth();
    const { colors, theme, setTheme } = useTheme();
    const {
        notifications,
        setNotifications,
        mediaAutoplay,
        setMediaAutoplay,
        compactMode,
        setCompactMode,
    } = useSettings();

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.cardBackground, borderBottomColor: colors.borderColor }]}>
                <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Settings</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
                {/* Accounts Section */}
                <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>ACCOUNTS</Text>
                <Card style={[styles.settingsGroup, { backgroundColor: colors.cardBackground, borderColor: colors.borderColor }]} enableShadow={false}>
                    {savedAccounts.map((account, index) => {
                        const isActive = user?.id === account.userInfo.id;
                        return (
                            <React.Fragment key={account.id}>
                                <TouchableOpacity 
                                    style={styles.settingRow} 
                                    activeOpacity={0.7}
                                    onPress={() => !isActive && switchAccount(account.id)}
                                >
                                    <View style={styles.settingLeft}>
                                        <Avatar source={{ uri: account.userInfo.avatar }} size={40} containerStyle={{ borderWidth: 1, borderColor: colors.borderColor, borderRadius: 20 }} />
                                        <View style={{ marginLeft: 12, flex: 1 }}>
                                            <Text style={[styles.settingLabel, { color: colors.textPrimary }]} numberOfLines={1}>
                                                {account.userInfo.display_name || account.userInfo.username}
                                            </Text>
                                            <Text style={{ color: colors.textSecondary, fontSize: 12 }} numberOfLines={1}>
                                                @{account.userInfo.acct} • {account.instanceUrl.replace(/^https?:\/\//, '')}
                                            </Text>
                                        </View>
                                    </View>
                                    {isActive ? (
                                        <Ionicons name="checkmark-circle" size={24} color={colors.accentColor} />
                                    ) : (
                                        <TouchableOpacity onPress={() => logout(account.id)} hitSlop={{top:10, bottom:10, left:10, right:10}}>
                                            <Ionicons name="log-out-outline" size={20} color={colors.dangerColor} />
                                        </TouchableOpacity>
                                    )}
                                </TouchableOpacity>
                                <View style={[styles.divider, { backgroundColor: colors.borderColor }]} />
                            </React.Fragment>
                        );
                    })}
                    
                    <TouchableOpacity 
                        style={[styles.settingRow, { justifyContent: 'center' }]} 
                        activeOpacity={0.7}
                        onPress={() => setAddingAccount(true)}
                    >
                        <Ionicons name="add-circle-outline" size={20} color={colors.accentColor} style={{ marginRight: 8 }} />
                        <Text style={[styles.settingLabel, { color: colors.accentColor }]}>Add Account</Text>
                    </TouchableOpacity>
                </Card>

                {/* Preferences Section */}
                <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>PREFERENCES</Text>
                <Card style={[styles.settingsGroup, { backgroundColor: colors.cardBackground, borderColor: colors.borderColor }]} enableShadow={false}>
                    {/* Push Notifications Row */}
                    <View style={styles.settingRow}>
                        <View style={styles.settingLeft}>
                            <Ionicons name="notifications-outline" size={20} color={colors.accentColor} style={styles.rowIcon} />
                            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Push Notifications</Text>
                        </View>
                        <Switch
                            value={notifications}
                            onValueChange={setNotifications}
                            trackColor={{ false: colors.borderColor, true: colors.accentColor }}
                            thumbColor={colors.buttonTextColor}
                        />
                    </View>

                    <View style={[styles.divider, { backgroundColor: colors.borderColor }]} />

                    {/* Autoplay Media Row */}
                    <View style={styles.settingRow}>
                        <View style={styles.settingLeft}>
                            <Ionicons name="play-circle-outline" size={20} color={colors.accentColor} style={styles.rowIcon} />
                            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Autoplay Media</Text>
                        </View>
                        <Switch
                            value={mediaAutoplay}
                            onValueChange={setMediaAutoplay}
                            trackColor={{ false: colors.borderColor, true: colors.accentColor }}
                            thumbColor={colors.buttonTextColor}
                        />
                    </View>

                    <View style={[styles.divider, { backgroundColor: colors.borderColor }]} />

                    {/* Compact Mode Row */}
                    <View style={styles.settingRow}>
                        <View style={styles.settingLeft}>
                            <Ionicons name="list-outline" size={20} color={colors.accentColor} style={styles.rowIcon} />
                            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Compact Mode</Text>
                        </View>
                        <Switch
                            value={compactMode}
                            onValueChange={setCompactMode}
                            trackColor={{ false: colors.borderColor, true: colors.accentColor }}
                            thumbColor={colors.buttonTextColor}
                        />
                    </View>

                    <View style={[styles.divider, { backgroundColor: colors.borderColor }]} />

                    {/* Dynamic Theme Selector Row */}
                    <View style={[styles.settingRow, { height: 60 }]}>
                        <View style={styles.settingLeft}>
                            <Ionicons name="color-palette-outline" size={20} color={colors.accentColor} style={styles.rowIcon} />
                            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Theme</Text>
                        </View>
                        <View style={styles.themeSelectorContainer}>
                            <TouchableOpacity
                                style={[
                                    styles.themePill,
                                    { borderColor: colors.borderColor },
                                    theme === 'light' && { backgroundColor: colors.accentColor, borderColor: colors.accentColor }
                                ]}
                                onPress={() => setTheme('light')}
                                activeOpacity={0.7}
                            >
                                <Text style={[
                                    styles.themePillText,
                                    { color: colors.textSecondary },
                                    theme === 'light' && { color: colors.buttonTextColor }
                                ]}>Light</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.themePill,
                                    { borderColor: colors.borderColor },
                                    theme === 'dark' && { backgroundColor: colors.accentColor, borderColor: colors.accentColor }
                                ]}
                                onPress={() => setTheme('dark')}
                                activeOpacity={0.7}
                            >
                                <Text style={[
                                    styles.themePillText,
                                    { color: colors.textSecondary },
                                    theme === 'dark' && { color: colors.buttonTextColor }
                                ]}>Dark</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.themePill,
                                    { borderColor: colors.borderColor },
                                    theme === 'system' && { backgroundColor: colors.accentColor, borderColor: colors.accentColor }
                                ]}
                                onPress={() => setTheme('system')}
                                activeOpacity={0.7}
                            >
                                <Text style={[
                                    styles.themePillText,
                                    { color: colors.textSecondary },
                                    theme === 'system' && { color: colors.buttonTextColor }
                                ]}>System</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Card>

                {/* About App Section */}
                <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>ABOUT</Text>
                <Card style={[styles.settingsGroup, { backgroundColor: colors.cardBackground, borderColor: colors.borderColor }]} enableShadow={false}>
                    <View style={styles.settingRow}>
                        <View style={styles.settingLeft}>
                            <Ionicons name="information-circle-outline" size={20} color={colors.accentColor} style={styles.rowIcon} />
                            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>App Version</Text>
                        </View>
                        <Text style={[styles.settingValue, { color: colors.textSecondary }]}>1.0.0 (Expo v56)</Text>
                    </View>

                    <View style={[styles.divider, { backgroundColor: colors.borderColor }]} />

                    <TouchableOpacity style={styles.settingRow} activeOpacity={0.7}>
                        <View style={styles.settingLeft}>
                            <Ionicons name="shield-checkmark-outline" size={20} color={colors.accentColor} style={styles.rowIcon} />
                            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Privacy Policy</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                </Card>

                {/* Log Out Action */}
                <Button
                    label="Log Out"
                    link
                    color={colors.dangerColor}
                    style={styles.logoutButton}
                    onPress={logout}
                    labelStyle={[styles.logoutLabel, { color: colors.dangerColor }]}
                    iconSource={() => <Ionicons name="log-out-outline" size={18} color={colors.dangerColor} style={{ marginRight: 6 }} />}
                />
            </ScrollView>
        </SafeAreaView>
    );
};

export default Settings;
