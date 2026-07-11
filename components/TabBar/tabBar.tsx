import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../services/themeContext';
import { styles } from './styles';

interface TabBarProps {
    activeTab: 'home' | 'search' | 'notifications' | 'profile';
    onTabPress: (tab: 'home' | 'search' | 'notifications' | 'profile') => void;
    onComposePress: () => void;
}

export const TabBar: React.FC<TabBarProps> = ({ activeTab, onTabPress, onComposePress }) => {
    const { colors, isDark } = useTheme();

    return (
        <View style={styles.dockWrapper} pointerEvents="box-none">
            <BlurView intensity={isDark ? 30 : 60} tint={isDark ? 'dark' : 'light'} style={[styles.tabBarContainer, { borderColor: colors.borderColor }]}>
                {/* Home */}
                <TouchableOpacity onPress={() => onTabPress('home')} style={styles.tabItem} activeOpacity={0.7}>
                    <Ionicons name={activeTab === 'home' ? 'home' : 'home-outline'} size={24} color={activeTab === 'home' ? colors.tabBarActiveColor : colors.tabBarInactiveColor} />
                </TouchableOpacity>

                {/* Search */}
                <TouchableOpacity onPress={() => onTabPress('search')} style={styles.tabItem} activeOpacity={0.7}>
                    <Ionicons name={activeTab === 'search' ? 'search' : 'search-outline'} size={24} color={activeTab === 'search' ? colors.tabBarActiveColor : colors.tabBarInactiveColor} />
                </TouchableOpacity>

                {/* Center Compose */}
                <View style={styles.centerActionWrapper}>
                    <TouchableOpacity onPress={onComposePress} style={[styles.centerActionButton, { backgroundColor: colors.accentColor }]} activeOpacity={0.9}>
                        <Ionicons name="add" size={28} color="#FFF" />
                    </TouchableOpacity>
                </View>

                {/* Notifications */}
                <TouchableOpacity onPress={() => onTabPress('notifications')} style={styles.tabItem} activeOpacity={0.7}>
                    <Ionicons name={activeTab === 'notifications' ? 'notifications' : 'notifications-outline'} size={24} color={activeTab === 'notifications' ? colors.tabBarActiveColor : colors.tabBarInactiveColor} />
                </TouchableOpacity>

                {/* Profile */}
                <TouchableOpacity onPress={() => onTabPress('profile')} style={styles.tabItem} activeOpacity={0.7}>
                    <Ionicons name={activeTab === 'profile' ? 'person' : 'person-outline'} size={24} color={activeTab === 'profile' ? colors.tabBarActiveColor : colors.tabBarInactiveColor} />
                </TouchableOpacity>
            </BlurView>
        </View>
    );
};
