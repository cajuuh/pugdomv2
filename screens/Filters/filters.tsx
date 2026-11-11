import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/ui/icon';
import { useTheme } from '../../services/themeContext';
import { useI18n } from '../../services/i18n/i18nContext';
import { Translator } from '../../services/i18n/translate';
import { useFilterActions, useFilters } from '../../hooks/useFilters';
import { FilterFields } from '../../services/mastodon/filters';
import { Filter, FilterAction, FilterContext } from '../../services/mastodon/types';
import { hitSlopFor, radii, space } from '../../services/theme/shape';
import { TAB_BAR_CLEARANCE } from '../../components/TabBar/styles';
import { Card, IconButton, PillButton, SectionLabel, ThemedSwitch } from '../../components/ui';
import { OptionSheet, SheetOption } from '../../components/ComposeModal/optionSheet';
import { formatScheduleTime } from '../../components/ComposeModal/scheduleSheet';
import { dialog } from '../../services/dialog';

export const FILTER_CONTEXTS: FilterContext[] = ['home', 'notifications', 'public', 'thread', 'account'];
const ACTION_KEY = { warn: 'filters.warn', hide: 'filters.hide', blur: 'filters.blur' } as const;
const ACTION_HINT = { warn: 'filters.warnHint', hide: 'filters.hideHint', blur: 'filters.blurHint' } as const;
const CONTEXT_KEY = {
    home: 'filters.contextHome',
    notifications: 'filters.contextNotifications',
    public: 'filters.contextPublic',
    thread: 'filters.contextThread',
    account: 'filters.contextAccount',
} as const;
// Seconds; 0 never expires, -1 keeps an existing filter's expiry
const KEEP = -1;
const EXPIRY: { seconds: number; key: 'filters.never' | 'filters.minutes30' | 'filters.hour1' | 'filters.hours12' | 'filters.day1' | 'filters.week1' }[] = [
    { seconds: 0, key: 'filters.never' },
    { seconds: 1800, key: 'filters.minutes30' },
    { seconds: 3600, key: 'filters.hour1' },
    { seconds: 43200, key: 'filters.hours12' },
    { seconds: 86400, key: 'filters.day1' },
    { seconds: 604800, key: 'filters.week1' },
];

interface Keyword {
    id?: string;
    keyword: string;
    whole_word: boolean;
}

// What the editor sends: kept keywords as they are, new ones added, removed ones destroyed
export const filterFields = (
    title: string,
    context: FilterContext[],
    action: FilterAction,
    expiry: number,
    keywords: Keyword[],
    removedIds: string[]
): FilterFields => ({
    title: title.trim(),
    context,
    filter_action: action,
    ...(expiry === KEEP ? {} : { expires_in: expiry === 0 ? '' : expiry }),
    keywords_attributes: [
        ...keywords.map(({ id, keyword, whole_word }) => ({ id, keyword, whole_word })),
        ...removedIds.map(id => ({ id, _destroy: true })),
    ],
});

const summary = (filter: Filter, { t, tn }: Translator) =>
    [t(ACTION_KEY[filter.filter_action]), tn('filters.keywordCount', filter.keywords?.length ?? 0), filter.context.map(c => t(CONTEXT_KEY[c])).join(', ')].join(' · ');

const Header = ({ title, onBack }: { title: string; onBack: () => void }) => {
    const { colors, type } = useTheme();
    const { t } = useI18n();
    const insets = useSafeAreaInsets();
    return (
        <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.borderColor, backgroundColor: colors.cardBackground }]}>
            <IconButton icon="arrow-back" accessibilityLabel={t('common.goBack')} onPress={onBack} />
            <Text accessibilityRole="header" style={[type.name, styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                {title}
            </Text>
            <View style={styles.spacer} />
        </View>
    );
};

// Your Mastodon filters (the same ones as on the website), each opening the editor
export const FilterList = ({ onBack, onEdit }: { onBack: () => void; onEdit: (filterId?: string) => void }) => {
    const { colors, type } = useTheme();
    const i18n = useI18n();
    const { t, locale } = i18n;
    const { data: filters, isLoading } = useFilters();

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Header title={t('filters.title')} onBack={onBack} />
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={[type.meta, styles.label, { color: colors.textMuted }]}>{t('filters.intro')}</Text>
                <PillButton label={t('filters.newFilter')} icon="add" onPress={() => onEdit()} style={styles.save} />
                {isLoading ? (
                    <ActivityIndicator color={colors.accentColor} />
                ) : !filters?.length ? (
                    <Text style={[type.body, styles.label, { color: colors.textMuted }]}>{t('filters.empty')}</Text>
                ) : (
                    <Card style={styles.settings}>
                        {filters.map((filter, index) => (
                            <React.Fragment key={filter.id}>
                                {index > 0 && <View style={[styles.divider, { backgroundColor: colors.borderColor }]} />}
                                <Pressable onPress={() => onEdit(filter.id)} accessibilityRole="button" style={styles.row}>
                                    <Icon name="options-outline" size={20} color={colors.accentText} />
                                    <View style={styles.rowText}>
                                        <Text style={[type.name, { color: colors.textPrimary }]} numberOfLines={1}>{filter.title}</Text>
                                        <Text style={[type.meta, { color: colors.textSecondary }]}>{summary(filter, i18n)}</Text>
                                        {!!filter.expires_at && (
                                            <Text style={[type.meta, { color: colors.textMuted }]}>
                                                {t('filters.expiresAt', { when: formatScheduleTime(new Date(filter.expires_at), locale) })}
                                            </Text>
                                        )}
                                    </View>
                                    <Icon name="chevron-forward" size={16} color={colors.textMuted} />
                                </Pressable>
                            </React.Fragment>
                        ))}
                    </Card>
                )}
            </ScrollView>
        </View>
    );
};

// Creates or edits one filter: name, keywords, where it applies, what it does and how long it lasts
export const FilterEditor = ({ filterId, onBack }: { filterId?: string; onBack: () => void }) => {
    const { colors, type } = useTheme();
    const { t, locale } = useI18n();
    const { data: filters } = useFilters();
    const existing = filters?.find(filter => filter.id === filterId);
    const actions = useFilterActions();

    const [title, setTitle] = useState('');
    const [keywords, setKeywords] = useState<Keyword[]>([]);
    const [removedIds, setRemovedIds] = useState<string[]>([]);
    const [newKeyword, setNewKeyword] = useState('');
    const [context, setContext] = useState<FilterContext[]>(['home', 'public']);
    const [action, setAction] = useState<FilterAction>('warn');
    const [expiry, setExpiry] = useState(filterId ? KEEP : 0);
    const [sheet, setSheet] = useState<'action' | 'expiry' | null>(null);
    const [busy, setBusy] = useState(false);

    // The filters may load after the screen opens
    useEffect(() => {
        if (!existing) return;
        setTitle(existing.title);
        setKeywords((existing.keywords ?? []).map(({ id, keyword, whole_word }) => ({ id, keyword, whole_word })));
        setContext(existing.context);
        setAction(existing.filter_action);
    }, [existing]);

    // Blur (Mastodon 4.4) is offered only to a filter that already has it, since older servers refuse it
    const actionOptions: SheetOption<FilterAction>[] = (['warn', 'hide', ...(existing?.filter_action === 'blur' ? ['blur' as const] : [])] as FilterAction[]).map(value => ({
        value,
        label: t(ACTION_KEY[value]),
        description: t(ACTION_HINT[value]),
    }));
    const expiryOptions: SheetOption<number>[] = [
        ...(filterId ? [{ value: KEEP, label: existing?.expires_at ? t('filters.expiresAt', { when: formatScheduleTime(new Date(existing.expires_at), locale) }) : t('filters.never') }] : []),
        ...EXPIRY.filter(option => !(filterId && !existing?.expires_at && option.seconds === 0)).map(option => ({ value: option.seconds, label: t(option.key) })),
    ];
    const expiryLabel = expiryOptions.find(option => option.value === expiry)?.label ?? t('filters.never');

    const addKeyword = () => {
        const keyword = newKeyword.trim();
        if (!keyword || keywords.some(k => k.keyword.toLowerCase() === keyword.toLowerCase())) return;
        setKeywords([...keywords, { keyword, whole_word: true }]);
        setNewKeyword('');
    };
    const removeKeyword = (index: number) => {
        const { id } = keywords[index];
        if (id) setRemovedIds([...removedIds, id]);
        setKeywords(keywords.filter((_, i) => i !== index));
    };
    const toggleContext = (value: FilterContext) =>
        setContext(context.includes(value) ? context.filter(c => c !== value) : FILTER_CONTEXTS.filter(c => c === value || context.includes(c)));

    const run = async (task: () => Promise<void>) => {
        setBusy(true);
        try {
            await task();
            onBack();
        } catch {
            dialog.toast(t('filters.failed'));
        } finally {
            setBusy(false);
        }
    };
    // A keyword typed but not added yet counts too
    const save = () => {
        const typed = newKeyword.trim();
        const all = typed && !keywords.some(k => k.keyword.toLowerCase() === typed.toLowerCase()) ? [...keywords, { keyword: typed, whole_word: true }] : keywords;
        return run(() => actions.save(filterId, filterFields(title, context, action, expiry, all, removedIds)));
    };
    const confirmDelete = () =>
        dialog.alert(t('filters.deleteTitle', { filter: existing?.title ?? title }), t('filters.deleteMessage'), [
            { text: t('filters.keep'), style: 'cancel' },
            { text: t('filters.delete'), style: 'destructive', onPress: () => run(() => actions.remove(filterId!)) },
        ]);

    const switchRow = (key: string, label: string, value: boolean, onChange: (value: boolean) => void) => (
        <View key={key} style={styles.row}>
            <Text style={[type.name, styles.rowText, { color: colors.textPrimary }]}>{label}</Text>
            <ThemedSwitch value={value} onValueChange={onChange} accessibilityLabel={label} />
        </View>
    );
    const pickerRow = (icon: 'eye-off-outline' | 'time-outline', label: string, value: string, onPress: () => void) => (
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}, ${value}`} style={styles.row}>
            <Icon name={icon} size={20} color={colors.accentText} />
            <Text style={[type.name, styles.rowText, { color: colors.textPrimary }]}>{label}</Text>
            <Text style={[type.meta, styles.value, { color: colors.textSecondary }]} numberOfLines={1}>{value}</Text>
            <Icon name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>
    );
    const divider = <View style={[styles.divider, { backgroundColor: colors.borderColor }]} />;

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Header title={filterId ? t('filters.editFilter') : t('filters.newFilter')} onBack={onBack} />

            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <View style={styles.field}>
                    <SectionLabel style={styles.label}>{t('filters.name')}</SectionLabel>
                    <TextInput
                        value={title}
                        onChangeText={setTitle}
                        placeholder={t('filters.namePlaceholder')}
                        placeholderTextColor={colors.textMuted}
                        accessibilityLabel={t('filters.name')}
                        style={[type.body, styles.input, { color: colors.textPrimary, backgroundColor: colors.inputBackground }]}
                    />
                </View>

                <View style={styles.field}>
                    <SectionLabel style={styles.label}>{t('filters.keywords')}</SectionLabel>
                    <View style={styles.addRow}>
                        <TextInput
                            value={newKeyword}
                            onChangeText={setNewKeyword}
                            onSubmitEditing={addKeyword}
                            placeholder={t('filters.keywordPlaceholder')}
                            placeholderTextColor={colors.textMuted}
                            accessibilityLabel={t('filters.keywordPlaceholder')}
                            autoCapitalize="none"
                            submitBehavior="submit"
                            returnKeyType="done"
                            style={[type.body, styles.input, styles.rowText, { color: colors.textPrimary, backgroundColor: colors.inputBackground }]}
                        />
                        <PillButton label={t('filters.add')} variant="secondary" onPress={addKeyword} disabled={!newKeyword.trim()} />
                    </View>
                    {keywords.length > 0 && (
                        <Card style={styles.settings}>
                            {keywords.map((keyword, index) => (
                                <React.Fragment key={keyword.id ?? `new-${keyword.keyword}`}>
                                    {index > 0 && divider}
                                    <View style={styles.row}>
                                        <View style={styles.rowText}>
                                            <Text style={[type.name, { color: colors.textPrimary }]} numberOfLines={1}>{keyword.keyword}</Text>
                                            <Text style={[type.meta, { color: colors.textMuted }]}>{t('filters.wholeWord')}</Text>
                                        </View>
                                        <ThemedSwitch
                                            value={keyword.whole_word}
                                            onValueChange={whole_word => setKeywords(keywords.map((k, i) => (i === index ? { ...k, whole_word } : k)))}
                                            accessibilityLabel={t('filters.wholeWordLabel', { keyword: keyword.keyword })}
                                        />
                                        <IconButton
                                            icon="remove-circle-outline"
                                            color={colors.dangerColor}
                                            accessibilityLabel={t('filters.removeKeyword', { keyword: keyword.keyword })}
                                            onPress={() => removeKeyword(index)}
                                        />
                                    </View>
                                </React.Fragment>
                            ))}
                        </Card>
                    )}
                </View>

                <View style={styles.field}>
                    <SectionLabel style={styles.label}>{t('filters.contexts')}</SectionLabel>
                    <Card style={styles.settings}>
                        {FILTER_CONTEXTS.map((value, index) => (
                            <React.Fragment key={value}>
                                {index > 0 && divider}
                                {switchRow(value, t(CONTEXT_KEY[value]), context.includes(value), () => toggleContext(value))}
                            </React.Fragment>
                        ))}
                    </Card>
                </View>

                <Card style={styles.settings}>
                    {pickerRow('eye-off-outline', t('filters.action'), t(ACTION_KEY[action]), () => setSheet('action'))}
                    {divider}
                    {pickerRow('time-outline', t('filters.expires'), expiryLabel, () => setSheet('expiry'))}
                </Card>

                <PillButton
                    label={filterId ? t('filters.save') : t('filters.create')}
                    onPress={save}
                    disabled={!title.trim() || context.length === 0 || busy}
                    loading={busy}
                    style={styles.save}
                />

                {!!filterId && (
                    <Pressable
                        onPress={confirmDelete}
                        accessibilityRole="button"
                        accessibilityLabel={t('filters.delete')}
                        hitSlop={hitSlopFor(0, 24)}
                        style={({ pressed }) => [styles.delete, pressed && { opacity: 0.7 }]}
                    >
                        <Icon name="trash-outline" size={18} color={colors.dangerColor} />
                        <Text style={[type.name, { color: colors.dangerColor }]}>{t('filters.delete')}</Text>
                    </Pressable>
                )}
            </ScrollView>

            <OptionSheet visible={sheet === 'action'} title={t('filters.action')} options={actionOptions} value={action} onSelect={setAction} onClose={() => setSheet(null)} />
            <OptionSheet visible={sheet === 'expiry'} title={t('filters.expires')} options={expiryOptions} value={expiry} onSelect={setExpiry} onClose={() => setSheet(null)} />
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
    addRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
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
    value: {
        flexShrink: 1,
        maxWidth: '50%',
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
