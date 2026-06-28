import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, Avatar } from 'react-native-ui-lib';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Account } from '../../services/mastodon/types';
import { useTheme } from '../../services/themeContext';
import { styles } from './styles';

interface TopBarProps {
    user: Account | null;
    onAvatarPress: () => void;
    onSettingsPress: () => void;
    onLogoutPress: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ user, onAvatarPress, onSettingsPress, onLogoutPress }) => {
    const [menuVisible, setMenuVisible] = useState(false);
    const { colors } = useTheme();

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.cardBackground, borderBottomColor: colors.borderColor }]}>
            <View style={styles.container}>
                <TouchableOpacity onPress={onAvatarPress} style={styles.avatarContainer} activeOpacity={0.7}>
                    {user?.avatar ? (
                        <Avatar source={{ uri: user.avatar }} size={34} containerStyle={[styles.avatar, { borderColor: colors.accentColor }]} />
                    ) : (
                        <Ionicons name="person-circle-outline" size={34} color={colors.textSecondary} />
                    )}
                </TouchableOpacity>

                <View style={styles.titleContainer}>
                    <Text style={[styles.titleText, { color: colors.accentColor }]}>pugdom</Text>
                </View>

                <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.menuButton} activeOpacity={0.7}>
                    <Ionicons name="ellipsis-vertical" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
            </View>

            {/* 3-Dot Dropdown Menu Modal */}
            <Modal
                visible={menuVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setMenuVisible(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
                    <View style={[styles.dropdownContainer, { backgroundColor: colors.cardBackground, borderColor: colors.borderColor }]}>
                        <TouchableOpacity
                            style={styles.dropdownItem}
                            onPress={() => {
                                setMenuVisible(false);
                                onSettingsPress();
                            }}
                        >
                            <Ionicons name="settings-outline" size={18} color={colors.textPrimary} style={styles.dropdownIcon} />
                            <Text style={[styles.dropdownText, { color: colors.textPrimary }]}>Settings</Text>
                        </TouchableOpacity>

                        <View style={[styles.divider, { backgroundColor: colors.borderColor }]} />

                        <TouchableOpacity
                            style={styles.dropdownItem}
                            onPress={() => {
                                setMenuVisible(false);
                                onLogoutPress();
                            }}
                        >
                            <Ionicons name="log-out-outline" size={18} color={colors.dangerColor} style={styles.dropdownIcon} />
                            <Text style={[styles.dropdownText, { color: colors.dangerColor }]}>Log Out</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
};
