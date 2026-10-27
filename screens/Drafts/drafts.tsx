import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../services/themeContext';
import { useI18n } from '../../services/i18n/i18nContext';
import { useOptionalAuth } from '../../services/authContext';
import { useCompose } from '../../services/composeContext';
import { Draft, deleteDraft, draftsQueryKey, getDrafts } from '../../services/drafts';
import { radii, space } from '../../services/theme/shape';
import { TAB_BAR_CLEARANCE } from '../../components/TabBar/styles';
import { Card, IconButton, PillButton } from '../../components/ui';
import { formatScheduleTime } from '../../components/ComposeModal/scheduleSheet';
import { dialog } from '../../services/dialog';

interface DraftsProps {
    onBack: () => void;
}

// Posts put aside on this phone, newest first: continue one in compose, or delete it
const Drafts = ({ onBack }: DraftsProps) => {
    const { colors, type } = useTheme();
    const { t, tn, locale } = useI18n();
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();
    const { openCompose } = useCompose();
    const accountId = useOptionalAuth()?.user?.id ?? '';
    const key = draftsQueryKey(accountId);
    const { data: drafts = [], isLoading } = useQuery({ queryKey: key, queryFn: () => getDrafts(accountId) });

    const open = (draft: Draft) => openCompose({ replyToStatus: draft.replyTo ?? undefined, quoteStatus: draft.quote ?? undefined, draft });

    const remove = (draft: Draft) =>
        dialog.alert(t('drafts.deleteTitle'), t('drafts.deleteMessage'), [
            { text: t('drafts.keep'), style: 'cancel' },
            {
                text: t('drafts.delete'),
                style: 'destructive',
                onPress: async () => {
                    try {
                        await deleteDraft(accountId, draft.id);
                        queryClient.setQueryData<Draft[]>(key, list => list?.filter(entry => entry.id !== draft.id));
                    } catch (error) {
                        console.warn('Deleting the draft failed:', error);
                        dialog.toast(t('drafts.deleteFailed'));
                    }
                },
            },
        ]);

    const renderItem = ({ item }: { item: Draft }) => {
        const text = item.spoilerText ? `⚠ ${item.spoilerText}` : item.text;
        const details = [
            item.replyTo ? t('drafts.replyTo', { acct: item.replyTo.account.acct }) : null,
            item.media.length > 0 ? tn('drafts.attachments', item.media.length) : null,
            item.poll ? t('drafts.poll') : null,
            item.scheduledAt ? t('drafts.scheduled', { when: formatScheduleTime(new Date(item.scheduledAt), locale) }) : null,
        ].filter(Boolean);
        return (
            <Card style={styles.card}>
                <Pressable onPress={() => open(item)} accessibilityRole="button" accessibilityLabel={`${t('drafts.open')}: ${text}`} style={styles.body}>
                    <Text style={[type.meta, { color: colors.textMuted }]}>
                        {t('drafts.savedAt', { when: formatScheduleTime(new Date(item.savedAt), locale) })}
                    </Text>
                    {!!text && (
                        <Text style={[type.body, { color: colors.textPrimary }]} numberOfLines={4}>
                            {text}
                        </Text>
                    )}
                    {details.length > 0 && <Text style={[type.meta, { color: colors.textMuted }]}>{details.join(' · ')}</Text>}
                </Pressable>
                <View style={styles.actions}>
                    <PillButton label={t('drafts.open')} icon="create-outline" variant="ghost" size="small" onPress={() => open(item)} />
                    <PillButton label={t('drafts.delete')} icon="trash-outline" variant="ghost" size="small" onPress={() => remove(item)} />
                </View>
            </Card>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.borderColor, backgroundColor: colors.cardBackground }]}>
                <IconButton icon="arrow-back" accessibilityLabel={t('common.goBack')} onPress={onBack} />
                <Text accessibilityRole="header" style={[type.name, styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                    {t('drafts.title')}
                </Text>
                <View style={styles.spacer} />
            </View>
            {isLoading ? (
                <ActivityIndicator style={styles.loading} color={colors.accentColor} />
            ) : (
                <FlashList
                    data={drafts}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="document-text-outline" size={28} color={colors.textMuted} />
                            <Text style={[type.body, styles.emptyText, { color: colors.textMuted }]}>{t('drafts.empty')}</Text>
                        </View>
                    }
                />
            )}
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
    loading: {
        marginTop: space.xl,
    },
    list: {
        paddingTop: space.md,
        paddingHorizontal: space.lg,
        paddingBottom: TAB_BAR_CLEARANCE,
    },
    card: {
        padding: space.md,
        marginBottom: space.md,
        gap: space.sm,
        borderRadius: radii.card,
    },
    body: {
        gap: space.sm,
    },
    actions: {
        flexDirection: 'row',
        gap: space.sm,
    },
    empty: {
        alignItems: 'center',
        gap: space.sm,
        marginTop: space.xl,
        paddingHorizontal: space.xl,
    },
    emptyText: {
        textAlign: 'center',
    },
});

export default Drafts;
