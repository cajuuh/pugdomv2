import React from 'react';
import { Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../services/themeContext';
import { makeStyles } from './styles';
import { useThemedStyles } from '../../services/theme/useThemedStyles';
import { useI18n } from '../../services/i18n/i18nContext';

type Tab = 'home' | 'search' | 'notifications' | 'profile';

interface TabBarProps {
    activeTab: Tab;
    onTabPress: (tab: Tab) => void;
    onComposePress: () => void;
    // A dot on the bell for notifications you haven't seen
    unreadNotifications?: boolean;
}

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// Outline icon when idle, filled when active
const TABS: Record<Tab, { icon: IconName; activeIcon: IconName }> = {
    home: { icon: 'home-outline', activeIcon: 'home' },
    search: { icon: 'search-outline', activeIcon: 'search' },
    notifications: { icon: 'notifications-outline', activeIcon: 'notifications' },
    profile: { icon: 'person-outline', activeIcon: 'person' },
};

export const TabBar: React.FC<TabBarProps> = ({ activeTab, onTabPress, onComposePress, unreadNotifications = false }) => {
    const { colors, isDark } = useTheme();
    const styles = useThemedStyles(makeStyles);
    const { t } = useI18n();

    const tab = (key: Tab) => {
        const { icon, activeIcon } = TABS[key];
        const active = key === activeTab;
        // The open tab already shows them
        const dot = key === 'notifications' && unreadNotifications && !active;
        const label = dot ? t('tabs.notificationsUnread') : t(`tabs.${key}`);
        return (
            <Pressable
                key={key}
                onPress={() => onTabPress(key)}
                accessibilityRole="tab"
                accessibilityLabel={label}
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [styles.tab, active && styles.tabActive, pressed && { opacity: 0.7 }]}
            >
                <View>
                    <Ionicons name={active ? activeIcon : icon} size={24} color={active ? colors.accentText : colors.textMuted} />
                    {dot && <View testID="unread-dot" style={styles.dot} />}
                </View>
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
                    accessibilityLabel={t('tabs.newPost')}
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
