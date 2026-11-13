import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useCustomEmojis } from '../../hooks/useCustomEmojis';
import { useDebounced } from '../../hooks/useSearch';
import { CustomEmoji } from '../../services/mastodon/types';
import { useTheme } from '../../services/themeContext';
import { useThemedStyles } from '../../services/theme/useThemedStyles';
import { SegmentedPill, SegmentOption } from '../ui';
import { BottomSheet } from './optionSheet';
import { makeStyles } from './styles';
import { useI18n } from '../../services/i18n/i18nContext';
import { getRecentEmojis } from '../../services/recentEmojis';
import { useOptionalSettings } from '../../services/settingsContext';

const COLUMNS = 7;
const SEARCH_DELAY = 250;
// Internal ids, shown as "All" / "Other" in the user's language; not valid category names on a server
export const ALL_CATEGORIES = '\u0000all';
export const UNCATEGORIZED = '\u0000other';
// The emoji you used last, above the rest in All
export const RECENT = '\u0000recent';

export interface EmojiGroup {
    category: string;
    emojis: CustomEmoji[];
}

// The server's categories A–Z, with uncategorized emoji last (shown as "Other")
export const groupByCategory = (emojis: CustomEmoji[]): EmojiGroup[] => {
    const groups = new Map<string, CustomEmoji[]>();
    for (const emoji of emojis) {
        const category = emoji.category?.trim() || UNCATEGORIZED;
        const group = groups.get(category);
        if (group) group.push(emoji);
        else groups.set(category, [emoji]);
    }
    return [...groups.entries()]
        .map(([category, list]) => ({ category, emojis: list }))
        .sort((a, b) => {
            if (a.category === UNCATEGORIZED) return 1;
            if (b.category === UNCATEGORIZED) return -1;
            return a.category.localeCompare(b.category);
        });
};

// Emoji whose shortcode has every word of the query, so "neofox pet" finds neofox_pet (colons and case ignored),
// those starting with its first word first
export const searchEmojis = (emojis: CustomEmoji[], query: string): CustomEmoji[] => {
    const words = query.replace(/:/g, '').toLowerCase().split(/[\s_]+/).filter(Boolean);
    if (!words.length) return [];
    const matches = emojis.filter(emoji => {
        const code = emoji.shortcode.toLowerCase();
        return words.every(word => code.includes(word));
    });
    return [...matches.filter(emoji => emoji.shortcode.toLowerCase().startsWith(words[0])), ...matches.filter(emoji => !emoji.shortcode.toLowerCase().startsWith(words[0]))];
};

// One flat list for FlashList: a header, then rows of up to COLUMNS emoji
type PickerItem = { kind: 'header'; title: string } | { kind: 'row'; emojis: CustomEmoji[] };

const toRows = (emojis: CustomEmoji[]): PickerItem[] => {
    const rows: PickerItem[] = [];
    for (let i = 0; i < emojis.length; i += COLUMNS) {
        rows.push({ kind: 'row', emojis: emojis.slice(i, i + COLUMNS) });
    }
    return rows;
};

type RowProps = { emojis: CustomEmoji[]; animated: boolean; onPick: (shortcode: string) => void; styles: ReturnType<typeof makeStyles> };

// Memoized: picking a category or typing re-renders the picker, not every row on screen
const EmojiRow = React.memo(({ emojis, animated, onPick, styles }: RowProps) => (
    <View style={styles.emojiRow}>
        {emojis.map(emoji => (
            <Pressable
                key={emoji.shortcode}
                onPress={() => onPick(emoji.shortcode)}
                accessibilityRole="button"
                accessibilityLabel={`:${emoji.shortcode}:`}
                style={({ pressed }) => [styles.emojiCell, pressed && styles.optionSelected]}
            >
                {/* Dozens of animated emoji on screen at once made scrolling stall, so they only move
                    with media autoplay on, as in posts' GIFs */}
                <Image
                    testID="emoji-image"
                    source={{ uri: (animated ? emoji.url : emoji.static_url) || emoji.url || emoji.static_url }}
                    style={styles.emojiImage}
                    resizeMode="contain"
                />
            </Pressable>
        ))}
        {/* Keep a short last row aligned to the grid */}
        {Array.from({ length: COLUMNS - emojis.length }, (_, i) => <View key={`gap-${i}`} style={styles.emojiCell} />)}
    </View>
));

interface EmojiPickerProps {
    visible: boolean;
    onPick: (shortcode: string) => void;
    onClose: () => void;
    // Whose recent emoji to show
    accountId?: string;
}

// The instance's custom emoji; picking one inserts its :shortcode:
export const EmojiPicker: React.FC<EmojiPickerProps> = ({ visible, onPick, onClose, accountId }) => {
    const { colors, type } = useTheme();
    const { t } = useI18n();
    const categoryLabel = (value: string) =>
        value === ALL_CATEGORIES ? t('emoji.all') : value === UNCATEGORIZED ? t('emoji.other') : value === RECENT ? t('emoji.recent') : value;
    const styles = useThemedStyles(makeStyles);
    const mediaAutoplay = useOptionalSettings()?.mediaAutoplay ?? false;
    const pick = useCallback((shortcode: string) => {
        onPick(shortcode);
        onClose();
    }, [onPick, onClose]);
    const [category, setCategory] = useState(ALL_CATEGORIES);
    const [query, setQuery] = useState('');
    const { data, isLoading, isError } = useCustomEmojis(visible);
    const pickable = useMemo(() => (data ?? []).filter(emoji => emoji.visible_in_picker), [data]);
    const groups = useMemo(() => groupByCategory(pickable), [pickable]);
    // Results wait for a pause in typing: each new list mounts dozens of images, animated ones included,
    // only for the next key to throw them away. Clearing the field doesn't wait.
    const debouncedQuery = useDebounced(query, SEARCH_DELAY);
    const shownQuery = query.trim() ? debouncedQuery.trim() : '';
    const searching = shownQuery.length > 0;
    const matches = useMemo(() => searchEmojis(pickable, shownQuery), [pickable, shownQuery]);

    const [recentCodes, setRecentCodes] = useState<string[]>([]);
    // Ones the server has since removed drop out
    const recent = useMemo(
        () => recentCodes.flatMap(code => pickable.filter(emoji => emoji.shortcode === code)),
        [recentCodes, pickable]
    );

    // Each opening starts with no search, and the latest recent emoji
    useEffect(() => {
        if (!visible) {
            setQuery('');
            return;
        }
        let cancelled = false;
        getRecentEmojis(accountId).then(codes => !cancelled && setRecentCodes(codes));
        return () => {
            cancelled = true;
        };
    }, [visible, accountId]);
    // Servers without categories keep the plain grid: no chips, no headers
    const categorized = groups.length > 1;

    // A category from another account's server falls back to All
    const activeCategory = groups.some(group => group.category === category) ? category : ALL_CATEGORIES;

    const chips: SegmentOption<string>[] = useMemo(
        () => [ALL_CATEGORIES, ...groups.map(group => group.category)].map(value => ({ value, label: categoryLabel(value) })),
        [groups, t]
    );
    // Headers in All when there's more than one section; a server without categories has its emoji under "All"
    const headers = activeCategory === ALL_CATEGORIES && !searching && (categorized || recent.length > 0);
    const sectionLabel = (title: string) => (title === UNCATEGORIZED && !categorized ? t('emoji.all') : categoryLabel(title));
    const items = useMemo((): PickerItem[] => {
        if (searching) return toRows(matches);
        if (activeCategory !== ALL_CATEGORIES) return toRows(groups.find(group => group.category === activeCategory)?.emojis ?? []);
        const sections = recent.length ? [{ category: RECENT, emojis: recent }, ...groups] : groups;
        return sections.flatMap(group => [
            ...(headers ? [{ kind: 'header' as const, title: group.category }] : []),
            ...toRows(group.emojis),
        ]);
    }, [groups, activeCategory, searching, matches, recent, headers]);
    const stickyHeaders = useMemo(
        () => items.flatMap((item, index) => (item.kind === 'header' ? [index] : [])),
        [items]
    );

    const status = isLoading
        ? <ActivityIndicator color={colors.accentColor} />
        : isError
            ? <Text style={[type.meta, styles.emojiStatusText]}>{t('emoji.loadFailed')}</Text>
            : groups.length === 0
                ? <Text style={[type.meta, styles.emojiStatusText]}>{t('emoji.none')}</Text>
                : null;

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
                    <View style={styles.emojiGrid}>
                        <FlashList
                            data={items}
                            // Recent emoji also sit in their own category, so rows are told apart by place too
                            keyExtractor={(item, index) => (item.kind === 'header' ? `h:${item.title}` : `${index}:${item.emojis[0].shortcode}`)}
                            getItemType={item => item.kind}
                            stickyHeaderIndices={stickyHeaders}
                            keyboardShouldPersistTaps="handled"
                            ListEmptyComponent={
                                searching ? <Text style={[type.meta, styles.emojiStatusText]}>{t('emoji.noMatches', { query: shownQuery })}</Text> : null
                            }
                            renderItem={({ item }) =>
                                item.kind === 'header' ? (
                                    <Text accessibilityRole="header" style={[type.label, styles.emojiSectionTitle]}>{sectionLabel(item.title)}</Text>
                                ) : (
                                    <EmojiRow emojis={item.emojis} animated={mediaAutoplay} onPick={pick} styles={styles} />
                                )
                            }
                        />
                    </View>
                </>
            )}
        </BottomSheet>
    );
};
