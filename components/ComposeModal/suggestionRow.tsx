import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../services/themeContext';
import { radii, space } from '../../services/theme/shape';
import { Avatar } from '../ui';

// Enough to scroll through without flooding the row
const MAX_SUGGESTIONS = 20;

export interface Suggestion {
    key: string;
    // An emoji's image, or a person's avatar (drawn round, with their name as fallback)
    image: string;
    person?: boolean;
    title: string;
    subtitle?: string;
    onPick: () => void;
}

// What matches the emoji or mention being typed, in a row above the toolbar; tapping one completes it
export const SuggestionRow: React.FC<{ label: string; suggestions: Suggestion[] }> = ({ label, suggestions }) => {
    const { colors, type } = useTheme();
    if (suggestions.length === 0) return null;

    return (
        <View style={[styles.bar, { borderTopColor: colors.borderColor }]} accessibilityLabel={label}>
            {/* Taps keep the keyboard up, so writing carries on */}
            <ScrollView horizontal keyboardShouldPersistTaps="always" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
                {suggestions.slice(0, MAX_SUGGESTIONS).map(item => (
                    <Pressable
                        key={item.key}
                        onPress={item.onPick}
                        accessibilityRole="button"
                        accessibilityLabel={item.subtitle ? `${item.title}, ${item.subtitle}` : item.title}
                        style={({ pressed }) => [styles.chip, { backgroundColor: pressed ? colors.accentSoft : colors.inputBackground }]}
                    >
                        {item.person ? (
                            <Avatar name={item.title} uri={item.image} size={28} />
                        ) : (
                            <Image source={{ uri: item.image }} style={styles.image} resizeMode="contain" />
                        )}
                        <View style={styles.text}>
                            <Text style={[item.person ? type.label : type.meta, { color: item.person ? colors.textPrimary : colors.textSecondary }]} numberOfLines={1}>
                                {item.title}
                            </Text>
                            {!!item.subtitle && (
                                <Text style={[type.meta, { color: colors.textMuted }]} numberOfLines={1}>
                                    {item.subtitle}
                                </Text>
                            )}
                        </View>
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
        maxWidth: 240,
        borderRadius: radii.pill,
        paddingHorizontal: space.sm,
        paddingVertical: space.xs,
    },
    image: {
        width: 24,
        height: 24,
    },
    text: {
        flexShrink: 1,
    },
});
