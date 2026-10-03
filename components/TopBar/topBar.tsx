import React, { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Account } from '../../services/mastodon/types';
import { useTheme } from '../../services/themeContext';
import { useThemedStyles } from '../../services/theme/useThemedStyles';
import { Avatar, IconButton, PugMark } from '../ui';
import { HEADER_HEIGHT, makeStyles } from './styles';
import { useI18n } from '../../services/i18n/i18nContext';

interface TopBarProps {
    user: Account | null;
    onProfilePress: () => void;
    onSettingsPress: () => void;
    onLogoutPress: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ user, onProfilePress, onSettingsPress, onLogoutPress }) => {
    const [menuVisible, setMenuVisible] = useState(false);
    const { colors, type, coat } = useTheme();
    const styles = useThemedStyles(makeStyles);
    const insets = useSafeAreaInsets();
    const { t } = useI18n();

    const menuAction = (action: () => void) => () => {
        setMenuVisible(false);
        action();
    };

    return (
        <SafeAreaView edges={['top']} style={styles.safeArea}>
            <View style={styles.container}>
                <Pressable
                    onPress={() => setMenuVisible(true)}
                    style={styles.avatarButton}
                    accessibilityRole="button"
                    accessibilityLabel={t('topBar.accountMenu')}
                >
                    <Avatar name={user?.display_name || user?.username || ''} uri={user?.avatar} size={36} ring />
                </Pressable>

                <View style={styles.wordmark} accessible accessibilityRole="header" accessibilityLabel="pugdom">
                    <PugMark coat={coat} size={28} />
                    <Text style={[type.title, styles.wordmarkText]}>pugdom</Text>
                </View>

                <IconButton icon="options-outline" accessibilityLabel={t('common.settings')} onPress={onSettingsPress} color={colors.textSecondary} size={24} style={styles.settingsButton} />
            </View>

            <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
                <View style={styles.modalRoot}>
                    {/* A sibling of the menu, not its parent: an accessible parent would hide the items from screen readers */}
                    <Pressable style={styles.modalOverlay} onPress={() => setMenuVisible(false)} accessibilityRole="button" accessibilityLabel={t('topBar.closeMenu')} />
                    <View style={[styles.menu, { top: insets.top + HEADER_HEIGHT }]}>
                        <Pressable style={styles.menuItem} onPress={menuAction(onProfilePress)} accessibilityRole="button" accessibilityLabel={t('common.profile')}>
                            <Ionicons name="person-outline" size={18} color={colors.textPrimary} />
                            <Text style={[type.name, styles.menuText]}>{t('common.profile')}</Text>
                        </Pressable>
                        <View style={styles.divider} />
                        <Pressable style={styles.menuItem} onPress={menuAction(onLogoutPress)} accessibilityRole="button" accessibilityLabel={t('common.logOut')}>
                            <Ionicons name="log-out-outline" size={18} color={colors.dangerColor} />
                            <Text style={[type.name, styles.menuText, styles.menuTextDanger]}>{t('common.logOut')}</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};
