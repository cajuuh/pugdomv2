import React from 'react';
import { StyleSheet, ScrollView, Switch, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, Avatar, Button, Card } from 'react-native-ui-lib';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../../services/authContext';
import { useSettings } from '../../services/settingsContext';
import { styles } from './styles';

interface SettingsProps {
    onBack: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onBack }) => {
    const { user, logout } = useAuth();
    const {
        notifications,
        setNotifications,
        mediaAutoplay,
        setMediaAutoplay,
        compactMode,
        setCompactMode,
    } = useSettings();

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={24} color="#F8FAFC" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Settings</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
                {user && (
                    <Card style={styles.userCard} enableShadow={false}>
                        <Avatar source={{ uri: user.avatar }} size={60} containerStyle={styles.userAvatar} />
                        <View style={styles.userInfo}>
                            <Text style={styles.displayName}>{user.display_name || user.username}</Text>
                            <Text style={styles.username}>@{user.username}</Text>
                            <Text style={styles.instanceText}>Authenticated Account</Text>
                        </View>
                    </Card>
                )}

                <Text style={styles.sectionTitle}>PREFERENCES</Text>
                <Card style={styles.settingsGroup} enableShadow={false}>
                    <View style={styles.settingRow}>
                        <View style={styles.settingLeft}>
                            <Ionicons name="notifications-outline" size={20} color="#6366F1" style={styles.rowIcon} />
                            <Text style={styles.settingLabel}>Push Notifications</Text>
                        </View>
                        <Switch
                            value={notifications}
                            onValueChange={setNotifications}
                            trackColor={{ false: '#334155', true: '#6366F1' }}
                            thumbColor={notifications ? '#F8FAFC' : '#94A3B8'}
                        />
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.settingRow}>
                        <View style={styles.settingLeft}>
                            <Ionicons name="play-circle-outline" size={20} color="#6366F1" style={styles.rowIcon} />
                            <Text style={styles.settingLabel}>Autoplay Media</Text>
                        </View>
                        <Switch
                            value={mediaAutoplay}
                            onValueChange={setMediaAutoplay}
                            trackColor={{ false: '#334155', true: '#6366F1' }}
                            thumbColor={mediaAutoplay ? '#F8FAFC' : '#94A3B8'}
                        />
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.settingRow}>
                        <View style={styles.settingLeft}>
                            <Ionicons name="list-outline" size={20} color="#6366F1" style={styles.rowIcon} />
                            <Text style={styles.settingLabel}>Compact Mode</Text>
                        </View>
                        <Switch
                            value={compactMode}
                            onValueChange={setCompactMode}
                            trackColor={{ false: '#334155', true: '#6366F1' }}
                            thumbColor={compactMode ? '#F8FAFC' : '#94A3B8'}
                        />
                    </View>
                </Card>

                <Text style={styles.sectionTitle}>ABOUT</Text>
                <Card style={styles.settingsGroup} enableShadow={false}>
                    <View style={styles.settingRow}>
                        <View style={styles.settingLeft}>
                            <Ionicons name="information-circle-outline" size={20} color="#6366F1" style={styles.rowIcon} />
                            <Text style={styles.settingLabel}>App Version</Text>
                        </View>
                        <Text style={styles.settingValue}>1.0.0 (Expo v56)</Text>
                    </View>

                    <View style={styles.divider} />

                    <TouchableOpacity style={styles.settingRow} activeOpacity={0.7}>
                        <View style={styles.settingLeft}>
                            <Ionicons name="shield-checkmark-outline" size={20} color="#6366F1" style={styles.rowIcon} />
                            <Text style={styles.settingLabel}>Privacy Policy</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                    </TouchableOpacity>
                </Card>

                <Button
                    label="Log Out"
                    link
                    color="#EF4444"
                    style={styles.logoutButton}
                    onPress={logout}
                    labelStyle={styles.logoutLabel}
                    iconSource={() => <Ionicons name="log-out-outline" size={18} color="#EF4444" style={{ marginRight: 6 }} />}
                />
            </ScrollView>
        </SafeAreaView>
    );
};

export default Settings;
