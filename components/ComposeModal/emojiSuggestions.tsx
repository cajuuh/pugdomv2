import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../services/themeContext';
import { useI18n } from '../../services/i18n/i18nContext';
import { radii, space } from '../../services/theme/shape';
import { CustomEmoji } from '../../services/mastodon/types';

// Enough to scroll through without flooding the row
const MAX_SUGGESTIONS = 20;

interface EmojiSuggestionsProps {
    matches: CustomEmoji[];
    onPick: (shortcode: string) => void;
}

// The custom emoji matching what's being typed, in a row above the toolbar; tapping one completes it
export const EmojiSuggestions: React.FC<EmojiSuggestionsProps> = ({ matches, onPick }) => {
    const { colors, type } = useTheme();
    const { t } = useI18n();
    if (matches.length === 0) return null;

    return (
        <View style={[styles.bar, { borderTopColor: colors.borderColor }]} accessibilityLabel={t('compose.emojiSuggestions')}>
            {/* Taps keep the keyboard up, so writing carries on */}
            <ScrollView horizontal keyboardShouldPersistTaps="always" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
                {matches.slice(0, MAX_SUGGESTIONS).map(emoji => (
                    <Pressable
                        key={emoji.shortcode}
                        onPress={() => onPick(emoji.shortcode)}
                        accessibilityRole="button"
                        accessibilityLabel={`:${emoji.shortcode}:`}
                        style={({ pressed }) => [styles.chip, { backgroundColor: pressed ? colors.accentSoft : colors.inputBackground }]}
                    >
                        <Image source={{ uri: emoji.static_url || emoji.url }} style={styles.image} resizeMode="contain" />
                        <Text style={[type.meta, { color: colors.textSecondary }]} numberOfLines={1}>
                            :{emoji.shortcode}:
                        </Text>
                    </Pressable>
                ))}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    bar: {
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    row: {
        gap: space.sm,
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        maxWidth: 220,
        borderRadius: radii.pill,
        paddingHorizontal: space.sm,
        paddingVertical: space.xs,
    },
    image: {
        width: 24,
        height: 24,
    },
});
