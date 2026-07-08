import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../services/themeContext';
import { styles } from './styles';

interface TabBarProps {
    activeTab: 'home' | 'notifications' | 'profile';
    onTabPress: (tab: 'home' | 'notifications' | 'profile') => void;
}

export const TabBar: React.FC<TabBarProps> = ({ activeTab, onTabPress }) => {
    const { colors } = useTheme();

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
