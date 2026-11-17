import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../services/themeContext';
import { useI18n } from '../../services/i18n/i18nContext';
import { useNavigator } from '../../services/navigationContext';
import { useCollection, useCollectionActions } from '../../hooks/useCollections';
import { COLLECTION_DESCRIPTION_MAX, COLLECTION_NAME_MAX } from '../../services/mastodon/collections';
import { plainText } from '../../services/htmlText';
import { dialog } from '../../services/dialog';
import { hitSlopFor, radii, space } from '../../services/theme/shape';
import { TAB_BAR_CLEARANCE } from '../../components/TabBar/styles';
import { Card, IconButton, PillButton, SectionLabel, ThemedSwitch } from '../../components/ui';
import { Icon, IconName } from '../../components/ui/icon';
import { TKey } from '../../services/i18n/translate';

interface CollectionEditorProps {
    // Editing one of yours; without it, a new collection is made
    collectionId?: string;
    onBack: () => void;
}

// Makes or edits one of your collections (Mastodon 4.6): its name, description, topic, and whether it shows on
// your profile or is marked sensitive; and deletes it. People are added from their profile's ⋯ menu.
const CollectionEditor = ({ collectionId, onBack }: CollectionEditorProps) => {
    const { colors, type } = useTheme();
    const { t } = useI18n();
    const insets = useSafeAreaInsets();
    const { push, pop } = useNavigator();
    const actions = useCollectionActions();
    const existing = useCollection(collectionId ?? '', !!collectionId).data?.collection;

    const [name, setName] = useState(existing?.name ?? '');
    const [description, setDescription] = useState(plainText(existing?.description ?? '').trim());
    const [topic, setTopic] = useState(existing?.tag?.name ?? '');
    const [discoverable, setDiscoverable] = useState(existing?.discoverable ?? true);
    const [sensitive, setSensitive] = useState(!!existing?.sensitive);
    const [busy, setBusy] = useState(false);

    // Opened before the collection had loaded: fill in what it has
    useEffect(() => {
        if (!existing) return;
        setName(existing.name);
        setDescription(plainText(existing.description ?? '').trim());
        setTopic(existing.tag?.name ?? '');
        setDiscoverable(existing.discoverable);
        setSensitive(existing.sensitive);
    }, [existing]);

    const run = async (task: () => Promise<void>) => {
        setBusy(true);
        try {
            await task();
        } catch {
            dialog.toast(t('collections.failed'));
        } finally {
            setBusy(false);
        }
    };

    const save = () =>
        run(async () => {
            const fields = { name: name.trim(), description: description.trim(), tag_name: topic.trim().replace(/^#+/, ''), discoverable, sensitive };
            if (collectionId) {
                await actions.update(collectionId, fields);
                onBack();
            } else {
                // The new collection opens in place of the editor
                const collection = await actions.create(fields);
                pop();
                push({ name: 'collection', collectionId: collection.id, collection });
            }
        });

    const confirmDelete = () =>
        dialog.alert(t('collections.deleteTitle', { name: existing?.name ?? name }), t('collections.deleteMessage'), [
            { text: t('collections.keep'), style: 'cancel' },
            {
                text: t('collections.delete'),
                style: 'destructive',
                onPress: () =>
                    run(async () => {
                        await actions.remove(collectionId!);
                        // Closes the editor and the collection it was opened from
                        pop();
                        pop();
                    }),
            },
        ]);

    const field = (label: TKey, value: string, onChange: (text: string) => void, max: number, placeholder: TKey, multiline = false) => (
        <View style={styles.field}>
            <View style={styles.labelRow}>
                <SectionLabel style={styles.label}>{t(label)}</SectionLabel>
                <Text style={[type.meta, { color: colors.textMuted }]}>{`${value.length}/${max}`}</Text>
            </View>
            <TextInput
                value={value}
                onChangeText={onChange}
                maxLength={max}
                multiline={multiline}
                placeholder={t(placeholder)}
                placeholderTextColor={colors.textMuted}
                accessibilityLabel={t(label)}
                style={[type.body, styles.input, multiline && styles.multiline, { color: colors.textPrimary, backgroundColor: colors.inputBackground }]}
            />
        </View>
    );

    const toggle = (icon: IconName, label: TKey, hint: TKey, value: boolean, onChange: (value: boolean) => void) => (
        <View style={styles.row}>
            <Icon name={icon} size={20} color={colors.accentText} />
            <View style={styles.rowText}>
                <Text style={[type.name, { color: colors.textPrimary }]}>{t(label)}</Text>
                <Text style={[type.meta, { color: colors.textMuted }]}>{t(hint)}</Text>
            </View>
            <ThemedSwitch value={value} onValueChange={onChange} accessibilityLabel={t(label)} />
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.borderColor, backgroundColor: colors.cardBackground }]}>
                <IconButton icon="arrow-back" accessibilityLabel={t('common.goBack')} onPress={onBack} />
                <Text accessibilityRole="header" style={[type.name, styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                    {t(collectionId ? 'collections.edit' : 'collections.new')}
                </Text>
                <View style={styles.spacer} />
            </View>

            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                {field('collections.name', name, setName, COLLECTION_NAME_MAX, 'collections.namePlaceholder')}
                {field('collections.description', description, setDescription, COLLECTION_DESCRIPTION_MAX, 'collections.descriptionPlaceholder', true)}
                <View style={styles.field}>
                    <SectionLabel style={styles.label}>{t('collections.topic')}</SectionLabel>
                    <View style={[styles.topic, { backgroundColor: colors.inputBackground }]}>
                        <Text style={[type.body, { color: colors.textMuted }]}>#</Text>
                        <TextInput
                            value={topic}
                            onChangeText={text => setTopic(text.replace(/^#+/, '').replace(/\s/g, ''))}
                            placeholder={t('collections.topicPlaceholder')}
                            placeholderTextColor={colors.textMuted}
                            accessibilityLabel={t('collections.topic')}
                            autoCapitalize="none"
                            autoCorrect={false}
                            style={[type.body, styles.topicInput, { color: colors.textPrimary }]}
                        />
                    </View>
                </View>

                <Card style={styles.settings}>
                    {toggle('eye-outline', 'collections.showOnProfile', 'collections.showOnProfileHint', discoverable, setDiscoverable)}
                    <View style={[styles.divider, { backgroundColor: colors.borderColor }]} />
                    {toggle('warning-outline', 'collections.sensitive', 'collections.sensitiveHint', sensitive, setSensitive)}
                </Card>

                <PillButton
                    label={t(collectionId ? 'collections.save' : 'collections.create')}
                    onPress={save}
                    disabled={!name.trim() || busy}
                    loading={busy}
                    style={styles.save}
                />

                {!!collectionId && (
                    <Pressable
                        onPress={confirmDelete}
                        accessibilityRole="button"
                        accessibilityLabel={t('collections.delete')}
                        hitSlop={hitSlopFor(0, 24)}
                        style={({ pressed }) => [styles.delete, pressed && { opacity: 0.7 }]}
                    >
                        <Icon name="trash-outline" size={18} color={colors.dangerColor} />
                        <Text style={[type.name, { color: colors.dangerColor }]}>{t('collections.delete')}</Text>
                    </Pressable>
                )}
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
        gap: space.md,
        padding: space.lg,
        paddingBottom: TAB_BAR_CLEARANCE,
    },
    field: {
        gap: space.xs,
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginRight: space.xs,
    },
    label: {
        marginHorizontal: space.xs,
    },
    input: {
        minHeight: 48,
        paddingHorizontal: space.md,
        borderRadius: radii.input,
    },
    multiline: {
        minHeight: 80,
        paddingTop: space.md,
        textAlignVertical: 'top',
    },
    topic: {
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        paddingHorizontal: space.md,
        borderRadius: radii.input,
    },
    topicInput: {
        flex: 1,
        paddingVertical: 0,
    },
    settings: {
        paddingHorizontal: space.md,
    },
    row: {
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: space.sm,
    },
    rowText: {
        flex: 1,
        minWidth: 0,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
    },
    save: {
        alignSelf: 'flex-start',
    },
    delete: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        alignSelf: 'flex-start',
        marginTop: space.md,
    },
});

export default CollectionEditor;
