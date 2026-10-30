import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, SectionList, Text, TextInput, View } from 'react-native';
import { useCustomEmojis } from '../../hooks/useCustomEmojis';
import { CustomEmoji } from '../../services/mastodon/types';
import { useTheme } from '../../services/themeContext';
import { useThemedStyles } from '../../services/theme/useThemedStyles';
import { SegmentedPill, SegmentOption } from '../ui';
import { BottomSheet } from './optionSheet';
import { makeStyles } from './styles';
import { useI18n } from '../../services/i18n/i18nContext';

const COLUMNS = 7;
// Internal ids, shown as "All" / "Other" in the user's language; not valid category names on a server
export const ALL_CATEGORIES = '\u0000all';
export const UNCATEGORIZED = '\u0000other';

export interface EmojiGroup {
    category: string;
    emojis: CustomEmoji[];
}

// The server's categories A–Z, with uncategorized emoji last (shown as "Other")
export const groupByCategory = (emojis: CustomEmoji[]): EmojiGroup[] => {
    const groups = new Map<string, CustomEmoji[]>();
    for (const emoji of emojis) {
        const category = emoji.category?.trim() || UNCATEGORIZED;
        groups.set(category, [...(groups.get(category) ?? []), emoji]);
    }
    return [...groups.entries()]
        .map(([category, list]) => ({ category, emojis: list }))
        .sort((a, b) => {
            if (a.category === UNCATEGORIZED) return 1;
            if (b.category === UNCATEGORIZED) return -1;
            return a.category.localeCompare(b.category);
        });
};

// Emoji whose shortcode contains the query (colons and case ignored), those starting with it first
export const searchEmojis = (emojis: CustomEmoji[], query: string): CustomEmoji[] => {
    const q = query.trim().replace(/:/g, '').toLowerCase();
    if (!q) return [];
    const matches = emojis.filter(emoji => emoji.shortcode.toLowerCase().includes(q));
    return [...matches.filter(emoji => emoji.shortcode.toLowerCase().startsWith(q)), ...matches.filter(emoji => !emoji.shortcode.toLowerCase().startsWith(q))];
};

// SectionList has no columns, so each item is a row of up to COLUMNS emoji
const toRows = (emojis: CustomEmoji[]) => {
    const rows: CustomEmoji[][] = [];
    for (let i = 0; i < emojis.length; i += COLUMNS) {
        rows.push(emojis.slice(i, i + COLUMNS));
    }
    return rows;
};

interface EmojiPickerProps {
    visible: boolean;
    onPick: (shortcode: string) => void;
    onClose: () => void;
}

// The instance's custom emoji; picking one inserts its :shortcode:
export const EmojiPicker: React.FC<EmojiPickerProps> = ({ visible, onPick, onClose }) => {
    const { colors, type } = useTheme();
    const { t } = useI18n();
    const categoryLabel = (value: string) =>
        value === ALL_CATEGORIES ? t('emoji.all') : value === UNCATEGORIZED ? t('emoji.other') : value;
    const styles = useThemedStyles(makeStyles);
    const [category, setCategory] = useState(ALL_CATEGORIES);
    const [query, setQuery] = useState('');
    const { data, isLoading, isError } = useCustomEmojis(visible);
    const pickable = useMemo(() => (data ?? []).filter(emoji => emoji.visible_in_picker), [data]);
    const groups = useMemo(() => groupByCategory(pickable), [pickable]);
    const searching = query.trim().length > 0;
    const matches = useMemo(() => searchEmojis(pickable, query), [pickable, query]);

    // Each opening starts with no search
    useEffect(() => {
        if (!visible) setQuery('');
    }, [visible]);
    // Servers without categories keep the plain grid: no chips, no headers
    const categorized = groups.length > 1;

    // A category from another account's server falls back to All
    const activeCategory = groups.some(group => group.category === category) ? category : ALL_CATEGORIES;

    const chips: SegmentOption<string>[] = useMemo(
        () => [ALL_CATEGORIES, ...groups.map(group => group.category)].map(value => ({ value, label: categoryLabel(value) })),
        [groups, t]
    );
    const sections = useMemo(() => {
        if (searching) return matches.length ? [{ title: '', data: toRows(matches) }] : [];
        const shown = activeCategory === ALL_CATEGORIES ? groups : groups.filter(group => group.category === activeCategory);
        return shown.map(group => ({ title: group.category, data: toRows(group.emojis) }));
    }, [groups, activeCategory, searching, matches]);

    const status = isLoading
        ? <ActivityIndicator color={colors.accentColor} />
        : isError
            ? <Text style={[type.meta, styles.emojiStatusText]}>{t('emoji.loadFailed')}</Text>
            : groups.length === 0
                ? <Text style={[type.meta, styles.emojiStatusText]}>{t('emoji.none')}</Text>
                : null;

    const renderEmoji = (emoji: CustomEmoji) => (
        <Pressable
            key={emoji.shortcode}
            onPress={() => {
                onPick(emoji.shortcode);
                onClose();
            }}
            accessibilityRole="button"
            accessibilityLabel={`:${emoji.shortcode}:`}
            style={({ pressed }) => [styles.emojiCell, pressed && styles.optionSelected]}
        >
            {/* The original, so animated emoji play here as they will in the post */}
            <Image testID="emoji-image" source={{ uri: emoji.url || emoji.static_url }} style={styles.emojiImage} resizeMode="contain" />
        </Pressable>
    );

    return (
        <BottomSheet visible={visible} title={t('emoji.title')} onClose={onClose}>
            {status ? (
                <View style={styles.emojiStatus}>{status}</View>
            ) : (
                <>
                    <TextInput
                        value={query}
                        onChangeText={setQuery}
                        placeholder={t('emoji.search')}
                        placeholderTextColor={colors.textMuted}
                        accessibilityLabel={t('emoji.search')}
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="search"
                        clearButtonMode="while-editing"
                        style={[type.body, styles.emojiSearch]}
                    />
                    {categorized && !searching && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiChipsRow} contentContainerStyle={styles.emojiChips}>
                            <SegmentedPill variant="chips" options={chips} value={activeCategory} onChange={setCategory} />
                        </ScrollView>
                    )}
                    <SectionList
                        sections={sections}
                        keyExtractor={row => row[0].shortcode}
                        style={styles.emojiGrid}
                        stickySectionHeadersEnabled
                        keyboardShouldPersistTaps="handled"
                        ListEmptyComponent={
                            searching ? <Text style={[type.meta, styles.emojiStatusText]}>{t('emoji.noMatches', { query: query.trim() })}</Text> : null
                        }
                        renderSectionHeader={({ section }) =>
                            categorized && activeCategory === ALL_CATEGORIES && !searching ? (
                                <Text accessibilityRole="header" style={[type.label, styles.emojiSectionTitle]}>{categoryLabel(section.title)}</Text>
                            ) : null
                        }
                        renderItem={({ item: row }) => (
                            <View style={styles.emojiRow}>
                                {row.map(renderEmoji)}
                                {/* Keep a short last row aligned to the grid */}
                                {Array.from({ length: COLUMNS - row.length }, (_, i) => <View key={`gap-${i}`} style={styles.emojiCell} />)}
                            </View>
                        )}
                    />
                </>
            )}
        </BottomSheet>
    );
};
