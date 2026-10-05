import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tag, weeklyUsage } from '../../services/mastodon/tags';
import { useOpenAccount } from '../../hooks/useOpenAccount';
import { useI18n } from '../../services/i18n/i18nContext';
import { useTheme } from '../../services/themeContext';
import { radii, space } from '../../services/theme/shape';

// A hashtag in a list, with this week's activity; the row opens the hashtag
export const HashtagRow: React.FC<{ tag: Tag }> = ({ tag }) => {
    const { colors, type } = useTheme();
    const { t, tn } = useI18n();
    const { openHashtag } = useOpenAccount();
    const usage = weeklyUsage(tag);
    const activity = usage.posts > 0
        ? t('hashtag.usage', { posts: tn('hashtag.posts', usage.posts), people: tn('hashtag.people', usage.people) })
        : t('hashtag.quiet');

    return (
        <Pressable
            onPress={() => openHashtag(tag.name)}
            accessibilityRole="link"
            accessibilityLabel={`#${tag.name}, ${activity}`}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
        >
            <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
                <Text style={[type.name, { color: colors.accentText }]}>#</Text>
            </View>
            <View style={styles.text}>
                <Text style={[type.name, { color: colors.textPrimary }]} numberOfLines={1}>#{tag.name}</Text>
                <Text style={[type.meta, { color: colors.textMuted }]} numberOfLines={1}>{activity}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: space.sm,
        paddingHorizontal: space.lg,
    },
    icon: {
        width: 44,
        height: 44,
        borderRadius: radii.pill,
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        flex: 1,
        minWidth: 0,
    },
});
