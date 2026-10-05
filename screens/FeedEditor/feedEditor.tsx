import React, { useState } from 'react';
import { DeviceEventEmitter, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../services/themeContext';
import { useI18n } from '../../services/i18n/i18nContext';
import { usePinnedFeeds } from '../../hooks/usePinnedFeeds';
import { createCustomHashtagFeed, describeCriteria } from '../../services/mastodon/feedTypes';
import { radii, space } from '../../services/theme/shape';
import { TAB_BAR_CLEARANCE } from '../../components/TabBar/styles';
import { IconButton, PillButton, SectionLabel } from '../../components/ui';

// Sent with the new feed, so the timeline can switch to it
export const FEED_CREATED_EVENT = 'feed_created';
// Sent with a feed to look at without pinning it (it shows as a preview pill)
export const FEED_OPEN_EVENT = 'feed_open';

// "#cats, pets  dogs" → ['cats', 'pets', 'dogs']: hashes optional, spaces or commas, no repeats
export const parseTags = (text: string) =>
    Array.from(new Set(text.split(/[\s,]+/).map(tag => tag.replace(/^#+/, '').trim().toLowerCase()).filter(Boolean)));

interface FeedEditorProps {
    onBack: () => void;
}

// Makes a hashtag feed: posts with any of the given hashtags, minus the excluded ones (Mastodon's
// /timelines/tag with any[] / none[]). Saved on this device and pinned straight away.
const FeedEditor = ({ onBack }: FeedEditorProps) => {
    const { colors, type } = useTheme();
    const { t } = useI18n();
    const insets = useSafeAreaInsets();
    const { addCustomFeed } = usePinnedFeeds();
    const [name, setName] = useState('');
    const [tagsText, setTagsText] = useState('');
    const [excludeText, setExcludeText] = useState('');
    const [saving, setSaving] = useState(false);

    const [main, ...more] = parseTags(tagsText);
    const exclude = parseTags(excludeText).filter(tag => tag !== main && !more.includes(tag));
    const preview = main ? describeCriteria({ tag: main, any: more, none: exclude }) : '';

    const save = async () => {
        if (!main) return;
        setSaving(true);
        try {
            const feed = createCustomHashtagFeed(name, main, more, [], exclude);
            await addCustomFeed(feed);
            DeviceEventEmitter.emit(FEED_CREATED_EVENT, feed);
            onBack();
        } finally {
            setSaving(false);
        }
    };

    const input = (label: string, value: string, onChange: (text: string) => void, placeholder: string, hint?: string) => (
        <View style={styles.field}>
            <SectionLabel style={styles.label}>{label}</SectionLabel>
            <TextInput
                value={value}
                onChangeText={onChange}
                placeholder={placeholder}
                placeholderTextColor={colors.textMuted}
                accessibilityLabel={label}
                autoCapitalize="none"
                autoCorrect={false}
                style={[type.body, styles.input, { color: colors.textPrimary, backgroundColor: colors.inputBackground }]}
            />
            {!!hint && <Text style={[type.meta, { color: colors.textMuted }]}>{hint}</Text>}
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.borderColor, backgroundColor: colors.cardBackground }]}>
                <IconButton icon="arrow-back" accessibilityLabel={t('common.goBack')} onPress={onBack} />
                <Text accessibilityRole="header" style={[type.name, styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                    {t('feeds.createCustom')}
                </Text>
                <View style={styles.spacer} />
            </View>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                {input(t('feeds.tags'), tagsText, setTagsText, t('feeds.tagsPlaceholder'), t('feeds.tagsHint'))}
                {input(t('feeds.excludeTags'), excludeText, setExcludeText, t('feeds.excludePlaceholder'))}
                {input(t('feeds.feedName'), name, setName, main ? `#${main}` : t('feeds.feedNamePlaceholder'))}
                {!!preview && (
                    <View style={[styles.preview, { backgroundColor: colors.accentSoft }]}>
                        <Text style={[type.meta, { color: colors.textSecondary }]}>{t('feeds.preview')}</Text>
                        <Text style={[type.name, { color: colors.textPrimary }]}>{preview}</Text>
                    </View>
                )}
                <PillButton label={t('feeds.saveAndPin')} icon="add" onPress={save} disabled={!main} loading={saving} style={styles.save} />
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingBottom: space.sm,
        paddingHorizontal: space.lg,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    title: {
        flex: 1,
        textAlign: 'center',
    },
    spacer: {
        width: 44,
    },
    content: {
        gap: space.lg,
        padding: space.lg,
        paddingBottom: TAB_BAR_CLEARANCE,
    },
    field: {
        gap: space.xs,
    },
    label: {
        marginHorizontal: space.xs,
    },
    input: {
        minHeight: 48,
        paddingHorizontal: space.md,
        borderRadius: radii.input,
    },
    preview: {
        gap: 2,
        padding: space.md,
        borderRadius: radii.well,
    },
    save: {
        alignSelf: 'flex-start',
    },
});

export default FeedEditor;
