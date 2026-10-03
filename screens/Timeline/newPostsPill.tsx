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
    onPress: () => void;
}

// Floats over the top of the list when newer posts are waiting; tapping loads them and scrolls up
export const NewPostsPill: React.FC<NewPostsPillProps> = ({ newPosts, loading, onPress }) => {
    const { colors, type } = useTheme();
    const styles = useThemedStyles(makeStyles);
    const { t, tn } = useI18n();
    const label = newPosts.more ? t('timeline.newPostsMany', { count: newPosts.count }) : tn('timeline.newPosts', newPosts.count);

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
                {newPosts.accounts.length > 0 && (
                    <View style={styles.newPostsAvatars}>
                        {newPosts.accounts.map((account, index) => (
                            <View key={account.id} style={[styles.newPostsAvatar, index > 0 && styles.newPostsAvatarStacked]}>
                                <Avatar name={account.display_name || account.username} uri={account.avatar} size={22} />
                            </View>
                        ))}
                    </View>
                )}
                <Text style={[type.name, styles.newPostsText]}>{label}</Text>
            </Pressable>
        </View>
    );
};
