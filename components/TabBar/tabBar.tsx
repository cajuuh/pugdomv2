import React from 'react';
import { Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../services/themeContext';
import { makeStyles } from './styles';
import { useThemedStyles } from '../../services/theme/useThemedStyles';

type Tab = 'home' | 'search' | 'notifications' | 'profile';

interface TabBarProps {
    activeTab: Tab;
    onTabPress: (tab: Tab) => void;
    onComposePress: () => void;
}

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// Outline icon when idle, filled when active
const TABS: Record<Tab, { label: string; icon: IconName; activeIcon: IconName }> = {
    home: { label: 'Home', icon: 'home-outline', activeIcon: 'home' },
    search: { label: 'Search', icon: 'search-outline', activeIcon: 'search' },
    notifications: { label: 'Notifications', icon: 'notifications-outline', activeIcon: 'notifications' },
    profile: { label: 'Profile', icon: 'person-outline', activeIcon: 'person' },
};

export const TabBar: React.FC<TabBarProps> = ({ activeTab, onTabPress, onComposePress }) => {
    const { colors, isDark } = useTheme();
    const styles = useThemedStyles(makeStyles);

    const tab = (key: Tab) => {
        const { label, icon, activeIcon } = TABS[key];
        const active = key === activeTab;
        return (
            <Pressable
                key={key}
                onPress={() => onTabPress(key)}
                accessibilityRole="tab"
                accessibilityLabel={label}
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [styles.tab, active && styles.tabActive, pressed && { opacity: 0.7 }]}
            >
                <Ionicons name={active ? activeIcon : icon} size={24} color={active ? colors.accentText : colors.textMuted} />
            </Pressable>
        );
    };

    return (
        <View style={[styles.dockWrapper, { shadowOpacity: isDark ? 0.5 : 0.14 }]} pointerEvents="box-none">
            <BlurView intensity={isDark ? 30 : 60} tint={isDark ? 'dark' : 'light'} style={styles.dock} accessibilityRole="tablist">
                {tab('home')}
                {tab('search')}
                <Pressable
                    onPress={onComposePress}
                    accessibilityRole="button"
                    accessibilityLabel="New post"
                    style={({ pressed }) => [styles.compose, pressed && { opacity: 0.85 }]}
                >
                    <Ionicons name="add" size={28} color={colors.buttonTextColor} />
                </Pressable>
                {tab('notifications')}
                {tab('profile')}
            </BlurView>
        </View>
    );
};
