import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../services/themeContext';
import { useI18n } from '../../services/i18n/i18nContext';
import { useListAccounts, useListActions, useLists } from '../../hooks/useLists';
import { usePinnedFeeds } from '../../hooks/usePinnedFeeds';
import { createListFeed } from '../../services/mastodon/feedTypes';
import { RepliesPolicy } from '../../services/mastodon/lists';
import { renderTextWithEmojis } from '../../services/emojiHelper';
import { hitSlopFor, radii, space } from '../../services/theme/shape';
import { TAB_BAR_CLEARANCE } from '../../components/TabBar/styles';
import { Avatar, Card, IconButton, PillButton, SectionLabel, ThemedSwitch } from '../../components/ui';
import { OptionSheet, SheetOption } from '../../components/ComposeModal/optionSheet';

interface ListEditorProps {
    // Editing an existing list; without it, a new list is created
    listId?: string;
    onBack: () => void;
}

const POLICY_KEY = { followed: 'lists.repliesFollowed', list: 'lists.repliesList', none: 'lists.repliesNone' } as const;

// Creates or edits one of your Mastodon lists: name, which replies show, hiding members from Home,
// its members, and deleting it. Changes are saved on the server, so they match the website.
const ListEditor = ({ listId, onBack }: ListEditorProps) => {
    const { colors, type } = useTheme();
    const { t } = useI18n();
    const insets = useSafeAreaInsets();
    const { data: lists } = useLists();
    const existing = lists?.find(list => list.id === listId);
    const { data: members, isLoading: membersLoading } = useListAccounts(listId);
    const actions = useListActions();
    const { isPinned, updatePinnedFeed, unpinFeed } = usePinnedFeeds();

    const [title, setTitle] = useState(existing?.title ?? '');
    const [policy, setPolicy] = useState<RepliesPolicy>(existing?.replies_policy ?? 'list');
    const [exclusive, setExclusive] = useState(!!existing?.exclusive);
    const [policySheet, setPolicySheet] = useState(false);
    const [busy, setBusy] = useState(false);

    // The list loads after the screen when it was opened straight from a link or pill
    useEffect(() => {
        if (!existing) return;
        setTitle(existing.title);
        setPolicy(existing.replies_policy);
        setExclusive(!!existing.exclusive);
    }, [existing]);

    const policies: SheetOption<RepliesPolicy>[] = (['followed', 'list', 'none'] as const).map(value => ({ value, label: t(POLICY_KEY[value]) }));

    const run = async (task: () => Promise<void>) => {
        setBusy(true);
        try {
            await task();
        } catch {
            Alert.alert(t('common.error'), t('lists.failed'));
        } finally {
            setBusy(false);
        }
    };

    const save = () =>
        run(async () => {
            const fields = { title: title.trim(), replies_policy: policy, exclusive };
            if (listId) {
                const list = await actions.update(listId, fields);
                // A pinned list's pill shows the new name
                if (isPinned(`list:${list.id}`)) await updatePinnedFeed(createListFeed(list));
            } else {
                await actions.create(fields);
            }
            onBack();
        });

    const confirmDelete = () =>
        Alert.alert(t('lists.deleteTitle', { list: existing?.title ?? title }), t('lists.deleteMessage'), [
            { text: t('lists.keep'), style: 'cancel' },
            {
                text: t('lists.delete'),
                style: 'destructive',
                onPress: () =>
                    run(async () => {
                        await actions.remove(listId!);
                        await unpinFeed(`list:${listId}`);
                        onBack();
                    }),
            },
        ]);

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.borderColor, backgroundColor: colors.cardBackground }]}>
                <IconButton icon="arrow-back" accessibilityLabel={t('common.goBack')} onPress={onBack} />
                <Text accessibilityRole="header" style={[type.name, styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                    {listId ? t('lists.editList') : t('lists.newList')}
                </Text>
                <View style={styles.spacer} />
            </View>

            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <View style={styles.field}>
                    <SectionLabel style={styles.label}>{t('lists.name')}</SectionLabel>
                    <TextInput
                        value={title}
                        onChangeText={setTitle}
                        placeholder={t('lists.namePlaceholder')}
                        placeholderTextColor={colors.textMuted}
                        accessibilityLabel={t('lists.name')}
                        style={[type.body, styles.input, { color: colors.textPrimary, backgroundColor: colors.inputBackground }]}
                    />
                </View>

                <Card style={styles.settings}>
                    <Pressable
                        onPress={() => setPolicySheet(true)}
                        accessibilityRole="button"
                        accessibilityLabel={`${t('lists.replies')}, ${t(POLICY_KEY[policy])}`}
                        style={styles.row}
                    >
                        <Ionicons name="chatbubbles-outline" size={20} color={colors.accentText} />
                        <Text style={[type.name, styles.rowText, { color: colors.textPrimary }]}>{t('lists.replies')}</Text>
                        <Text style={[type.meta, { color: colors.textSecondary }]}>{t(POLICY_KEY[policy])}</Text>
                        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                    </Pressable>
                    <View style={[styles.divider, { backgroundColor: colors.borderColor }]} />
                    <View style={styles.row}>
                        <Ionicons name="eye-off-outline" size={20} color={colors.accentText} />
                        <View style={styles.rowText}>
                            <Text style={[type.name, { color: colors.textPrimary }]}>{t('lists.exclusive')}</Text>
                            <Text style={[type.meta, { color: colors.textMuted }]}>{t('lists.exclusiveHint')}</Text>
                        </View>
                        <ThemedSwitch value={exclusive} onValueChange={setExclusive} accessibilityLabel={t('lists.exclusive')} />
                    </View>
                </Card>

                <PillButton
                    label={listId ? t('lists.save') : t('lists.create')}
                    onPress={save}
                    disabled={!title.trim() || busy}
                    loading={busy}
                    style={styles.save}
                />

                {!!listId && (
                    <>
                        <View style={styles.field}>
                            <SectionLabel style={styles.label}>{t('lists.members')}</SectionLabel>
                            <Text style={[type.meta, styles.label, { color: colors.textMuted }]}>{t('lists.membersHint')}</Text>
                        </View>
                        {membersLoading ? (
                            <ActivityIndicator color={colors.accentColor} />
                        ) : !members?.length ? (
                            <Text style={[type.body, styles.label, { color: colors.textMuted }]}>{t('lists.noMembers')}</Text>
                        ) : (
                            members.map(member => {
                                const name = member.display_name || member.username;
                                return (
                                    <View key={member.id} style={styles.member}>
                                        <Avatar name={name} uri={member.avatar} size={40} />
                                        <View style={styles.rowText}>
                                            <Text style={[type.name, { color: colors.textPrimary }]} numberOfLines={1}>
                                                {renderTextWithEmojis(name, member.emojis || [], [type.name, { color: colors.textPrimary }], 16)}
                                            </Text>
                                            <Text style={[type.meta, { color: colors.textMuted }]} numberOfLines={1}>@{member.acct}</Text>
                                        </View>
                                        <IconButton
                                            icon="remove-circle-outline"
                                            color={colors.dangerColor}
                                            accessibilityLabel={t('lists.removeMember', { name })}
                                            onPress={() => run(() => actions.removeMember(listId, member.id))}
                                        />
                                    </View>
                                );
                            })
                        )}
                        <Pressable
                            onPress={confirmDelete}
                            accessibilityRole="button"
                            accessibilityLabel={t('lists.delete')}
                            hitSlop={hitSlopFor(0, 24)}
                            style={({ pressed }) => [styles.delete, pressed && { opacity: 0.7 }]}
                        >
                            <Ionicons name="trash-outline" size={18} color={colors.dangerColor} />
                            <Text style={[type.name, { color: colors.dangerColor }]}>{t('lists.delete')}</Text>
                        </Pressable>
                    </>
                )}
            </ScrollView>

            <OptionSheet
                visible={policySheet}
                title={t('lists.replies')}
                options={policies}
                value={policy}
                onSelect={setPolicy}
                onClose={() => setPolicySheet(false)}
            />
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
    label: {
        marginHorizontal: space.xs,
    },
    input: {
        minHeight: 48,
        paddingHorizontal: space.md,
        borderRadius: radii.input,
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
    member: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
    },
    delete: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        alignSelf: 'flex-start',
        marginTop: space.md,
    },
});

export default ListEditor;
