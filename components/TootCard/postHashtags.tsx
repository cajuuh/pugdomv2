import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRecyclingState } from '@shopify/flash-list';
import { PillButton } from '../ui';
import { useI18n } from '../../services/i18n/i18nContext';
import { useTheme } from '../../services/themeContext';
import { hitSlopFor, radii, space } from '../../services/theme/shape';

const VISIBLE = 5;
const CHIP_HEIGHT = 28;

// The hashtags a post ends with, below its media and link preview. No top margin: the post's content
// gap spaces it the same after text as after media
export const PostHashtags: React.FC<{ tags: string[]; onPress: (tag: string) => void }> = ({ tags, onPress }) => {
    const { colors, type } = useTheme();
    const { t } = useI18n();
    const [expanded, setExpanded] = useRecyclingState(false, [tags]);
    if (tags.length === 0) return null;

    return (
        <View style={styles.row}>
            {(expanded ? tags : tags.slice(0, VISIBLE)).map(tag => (
                <Pressable
                    key={tag}
                    onPress={() => onPress(tag)}
                    accessibilityRole="link"
                    hitSlop={hitSlopFor(0, CHIP_HEIGHT)}
                    style={[styles.chip, { backgroundColor: colors.inputBackground }]}
                >
                    <Text style={[type.meta, { color: colors.accentText }]} numberOfLines={1}>#{tag}</Text>
                </Pressable>
            ))}
            {!expanded && tags.length > VISIBLE && (
                <PillButton label={t('post.showMore')} size="small" variant="subtle" onPress={() => setExpanded(true)} />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: space.xs,
    },
    chip: {
        height: CHIP_HEIGHT,
        maxWidth: '100%',
        justifyContent: 'center',
        paddingHorizontal: space.sm,
        borderRadius: radii.pill,
    },
});
