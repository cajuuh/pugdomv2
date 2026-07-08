import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../services/themeContext';
import { useCompose } from '../../services/composeContext';
import { styles } from './styles';

interface TabBarProps {
    activeTab: 'home' | 'notifications' | 'profile';
    onTabPress: (tab: 'home' | 'notifications' | 'profile') => void;
}

export const TabBar: React.FC<TabBarProps> = ({ activeTab, onTabPress }) => {
    const { colors } = useTheme();
    const { openCompose } = useCompose();

    return (
        <View style={[styles.tabBarContainer, { backgroundColor: colors.tabBarBackground, borderTopColor: colors.borderColor }]}>
            {/* Home Tab */}
            <TouchableOpacity
                onPress={() => onTabPress('home')}
                style={styles.tabItem}
                activeOpacity={0.7}
            >
                <Ionicons
                    name={activeTab === 'home' ? 'home' : 'home-outline'}
                    size={22}
                    color={activeTab === 'home' ? colors.tabBarActiveColor : colors.tabBarInactiveColor}
                />
                <Text style={[styles.tabLabel, { color: activeTab === 'home' ? colors.tabBarActiveColor : colors.tabBarInactiveColor }]}>
                    Home
                </Text>
            </TouchableOpacity>

            {/* Notifications Tab */}
            <TouchableOpacity
                onPress={() => onTabPress('notifications')}
                style={styles.tabItem}
                activeOpacity={0.7}
            >
                <Ionicons
                    name={activeTab === 'notifications' ? 'notifications' : 'notifications-outline'}
                    size={22}
                    color={activeTab === 'notifications' ? colors.tabBarActiveColor : colors.tabBarInactiveColor}
                />
                <Text style={[styles.tabLabel, { color: activeTab === 'notifications' ? colors.tabBarActiveColor : colors.tabBarInactiveColor }]}>
                    Alerts
                </Text>
            </TouchableOpacity>

            {/* Compose Button (Center) */}
            <View style={styles.composeButtonContainer}>
                <TouchableOpacity
                    onPress={() => openCompose()}
                    style={[styles.composeButton, { backgroundColor: colors.accentColor }]}
                    activeOpacity={0.8}
                >
                    <Ionicons
                        name="add"
                        size={28}
                        color={colors.buttonTextColor}
                    />
                </TouchableOpacity>
            </View>

            {/* Profile Tab */}
            <TouchableOpacity
                onPress={() => onTabPress('profile')}
                style={styles.tabItem}
                activeOpacity={0.7}
            >
                <Ionicons
                    name={activeTab === 'profile' ? 'person' : 'person-outline'}
                    size={22}
                    color={activeTab === 'profile' ? colors.tabBarActiveColor : colors.tabBarInactiveColor}
                />
                <Text style={[styles.tabLabel, { color: activeTab === 'profile' ? colors.tabBarActiveColor : colors.tabBarInactiveColor }]}>
                    Profile
                </Text>
            </TouchableOpacity>
        </View>
    );
};
