import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, Avatar } from 'react-native-ui-lib';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Account } from '../../services/mastodon/types';
import { styles } from './styles';

interface TopBarProps {
    user: Account | null;
    onAvatarPress: () => void;
    onSettingsPress: () => void;
    onLogoutPress: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ user, onAvatarPress, onSettingsPress, onLogoutPress }) => {
    const [menuVisible, setMenuVisible] = useState(false);

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <TouchableOpacity onPress={onAvatarPress} style={styles.avatarContainer} activeOpacity={0.7}>
                    {user?.avatar ? (
                        <Avatar source={{ uri: user.avatar }} size={34} containerStyle={styles.avatar} />
                    ) : (
                        <Ionicons name="person-circle-outline" size={34} color="#94A3B8" />
                    )}
                </TouchableOpacity>

                <View style={styles.titleContainer}>
                    <Text style={styles.titleText}>pugdom</Text>
                </View>

                <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.menuButton} activeOpacity={0.7}>
                    <Ionicons name="ellipsis-vertical" size={22} color="#F8FAFC" />
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
                    <View style={styles.dropdownContainer}>
                        <TouchableOpacity
                            style={styles.dropdownItem}
                            onPress={() => {
                                setMenuVisible(false);
                                onSettingsPress();
                            }}
                        >
                            <Ionicons name="settings-outline" size={18} color="#F8FAFC" style={styles.dropdownIcon} />
                            <Text style={styles.dropdownText}>Settings</Text>
                        </TouchableOpacity>

                        <View style={styles.divider} />

                        <TouchableOpacity
                            style={styles.dropdownItem}
                            onPress={() => {
                                setMenuVisible(false);
                                onLogoutPress();
                            }}
                        >
                            <Ionicons name="log-out-outline" size={18} color="#EF4444" style={styles.dropdownIcon} />
                            <Text style={[styles.dropdownText, styles.logoutText]}>Log Out</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
};
