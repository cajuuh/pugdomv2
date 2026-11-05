import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '../../components/ui';
import { NewPosts } from '../../hooks/useNewPosts';
import { useI18n } from '../../services/i18n/i18nContext';
import { useTheme } from '../../services/themeContext';
import { useThemedStyles } from '../../services/theme/useThemedStyles';
import { makeStyles } from './styles';

interface NewPostsPillProps {
    newPosts: NewPosts;
    loading: boolean;
    // You've scrolled since it appeared: only the arrow and the count, so it doesn't pull your eye from the posts
    collapsed: boolean;
    onPress: () => void;
}

// Floats over the top of the list when newer posts are waiting; tapping loads them and scrolls up
export const NewPostsPill: React.FC<NewPostsPillProps> = ({ newPosts, loading, collapsed, onPress }) => {
    const { colors, type } = useTheme();
    const styles = useThemedStyles(makeStyles);
    const { t, tn } = useI18n();
    const label = newPosts.more ? t('timeline.newPostsMany', { count: newPosts.count }) : tn('timeline.newPosts', newPosts.count);
    const shortLabel = newPosts.more ? `${newPosts.count}+` : String(newPosts.count);

    return (
        <View style={styles.newPostsWrap} pointerEvents="box-none">
            <Pressable
                onPress={onPress}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityHint={t('timeline.newPostsHint')}
                accessibilityState={{ busy: loading }}
                style={({ pressed }) => [styles.newPosts, pressed && { opacity: 0.85 }]}
            >
                {loading ? (
                    <ActivityIndicator size="small" color={colors.buttonTextColor} />
                ) : (
                    <Ionicons name="arrow-up" size={16} color={colors.buttonTextColor} />
                )}
                {!collapsed && newPosts.accounts.length > 0 && (
                    <View style={styles.newPostsAvatars}>
                        {newPosts.accounts.map((account, index) => (
                            <View key={account.id} style={[styles.newPostsAvatar, index > 0 && styles.newPostsAvatarStacked]}>
                                {/* The still picture: an animated avatar here distracts from the posts */}
                                <Avatar name={account.display_name || account.username} uri={account.avatar_static ?? account.avatar} size={22} />
                            </View>
                        ))}
                    </View>
                )}
                <Text style={[type.name, styles.newPostsText]}>{collapsed ? shortLabel : label}</Text>
            </Pressable>
        </View>
    );
};
