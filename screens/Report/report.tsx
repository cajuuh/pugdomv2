import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '../../services/themeContext';
import { useI18n } from '../../services/i18n/i18nContext';
import { TKey } from '../../services/i18n/translate';
import { Account, Status } from '../../services/mastodon/types';
import { createReport, getRules, REPORT_COMMENT_LIMIT, ReportCategory } from '../../services/mastodon/reports';
import { plainText } from '../../services/htmlText';
import { useModeration } from '../../hooks/useModeration';
import { radii, space } from '../../services/theme/shape';
import { TAB_BAR_CLEARANCE } from '../../components/TabBar/styles';
import { IconButton, PillButton, SectionLabel, ThemedSwitch, Well } from '../../components/ui';

const CATEGORIES: { value: ReportCategory; label: TKey; description: TKey }[] = [
    { value: 'spam', label: 'moderation.spam', description: 'moderation.spamDescription' },
    { value: 'violation', label: 'moderation.violation', description: 'moderation.violationDescription' },
    { value: 'legal', label: 'moderation.legal', description: 'moderation.legalDescription' },
    { value: 'other', label: 'moderation.other', description: 'moderation.otherDescription' },
];

interface ReportProps {
    account: Account;
    // The post being reported, attached to the report
    status?: Status;
    onBack: () => void;
}

// Tells the server's moderators about an account (and one of its posts): what's wrong, which
// rules it breaks, and anything else they should know. Afterwards, offers to mute or block.
const Report = ({ account, status, onBack }: ReportProps) => {
    const { colors, type } = useTheme();
    const { t } = useI18n();
    const insets = useSafeAreaInsets();
    const { mute, block } = useModeration();
    const [category, setCategory] = useState<ReportCategory | null>(null);
    const [ruleIds, setRuleIds] = useState<string[]>([]);
    const [comment, setComment] = useState('');
    const remoteServer = account.acct.includes('@') ? account.acct.split('@').pop() : undefined;
    const [forward, setForward] = useState(false);
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [failed, setFailed] = useState(false);
    const { data: rules = [] } = useQuery({ queryKey: ['instance', 'rules'], queryFn: getRules, staleTime: 60 * 60 * 1000 });

    // "Breaks server rules" needs rules to pick from
    const categories = CATEGORIES.filter(option => option.value !== 'violation' || rules.length > 0);
    const canSend = !!category && (category !== 'violation' || ruleIds.length > 0) && comment.length <= REPORT_COMMENT_LIMIT;

    const toggleRule = (id: string) => setRuleIds(current => (current.includes(id) ? current.filter(rule => rule !== id) : [...current, id]));

    const send = async () => {
        if (!category || !canSend) return;
        setSending(true);
        setFailed(false);
        try {
            await createReport({
                account_id: account.id,
                status_ids: status ? [status.id] : undefined,
                comment: comment.trim() || undefined,
                forward: remoteServer ? forward : undefined,
                category,
                rule_ids: category === 'violation' ? ruleIds : undefined,
            });
            setSent(true);
        } catch (error) {
            console.warn('Report failed:', error);
            setFailed(true);
        } finally {
            setSending(false);
        }
    };

    const choice = (role: 'radio' | 'checkbox', checked: boolean, label: string, description: string | undefined, onPress: () => void, key: string) => (
        <Pressable
            key={key}
            onPress={onPress}
            accessibilityRole={role}
            accessibilityState={{ checked }}
            accessibilityLabel={label}
            accessibilityHint={description}
            style={({ pressed }) => [styles.choice, { borderColor: checked ? colors.accentColor : colors.borderColor }, (checked || pressed) && { backgroundColor: colors.accentSoft }]}
        >
            <Ionicons
                name={role === 'radio' ? (checked ? 'radio-button-on' : 'radio-button-off') : checked ? 'checkbox' : 'square-outline'}
                size={20}
                color={checked ? colors.accentText : colors.textMuted}
            />
            <View style={styles.choiceText}>
                <Text style={[type.name, { color: colors.textPrimary }]}>{label}</Text>
                {!!description && <Text style={[type.meta, { color: colors.textMuted }]}>{description}</Text>}
            </View>
        </Pressable>
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.borderColor, backgroundColor: colors.cardBackground }]}>
                <IconButton icon="arrow-back" accessibilityLabel={t('common.goBack')} onPress={onBack} />
                <Text accessibilityRole="header" style={[type.name, styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                    {t('moderation.reportTitle', { acct: account.acct })}
                </Text>
                <View style={styles.spacer} />
            </View>

            {sent ? (
                <ScrollView contentContainerStyle={styles.content}>
                    <View style={styles.sent}>
                        <Ionicons name="checkmark-circle" size={48} color={colors.accentText} />
                        <Text style={[type.title, styles.centered, { color: colors.textPrimary }]}>{t('moderation.sentTitle')}</Text>
                        <Text style={[type.body, styles.centered, { color: colors.textSecondary }]}>{t('moderation.sentMessage')}</Text>
                    </View>
                    <SectionLabel style={styles.label}>{t('moderation.alsoTitle')}</SectionLabel>
                    <View style={styles.buttons}>
                        <PillButton label={t('moderation.muteAccount', { acct: account.acct })} icon="volume-mute-outline" variant="secondary" onPress={() => mute(account)} />
                        <PillButton label={t('moderation.blockAccount', { acct: account.acct })} icon="hand-left-outline" variant="secondary" onPress={() => block(account)} />
                    </View>
                    <PillButton label={t('compose.done')} onPress={onBack} style={styles.send} />
                </ScrollView>
            ) : (
                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                    {status && (
                        <View style={styles.field}>
                            <SectionLabel style={styles.label}>{t('moderation.attachedPost')}</SectionLabel>
                            <Well>
                                <Text style={[type.body, { color: colors.textSecondary }]} numberOfLines={4}>
                                    {status.spoiler_text || plainText(status.content)}
                                </Text>
                            </Well>
                        </View>
                    )}

                    <View style={styles.field}>
                        <SectionLabel style={styles.label}>{t('moderation.whatsWrong')}</SectionLabel>
                        {categories.map(option =>
                            choice('radio', category === option.value, t(option.label), t(option.description), () => setCategory(option.value), option.value)
                        )}
                    </View>

                    {category === 'violation' && (
                        <View style={styles.field}>
                            <SectionLabel style={styles.label}>{t('moderation.whichRules')}</SectionLabel>
                            {rules.map(rule => choice('checkbox', ruleIds.includes(rule.id), rule.text, rule.hint || undefined, () => toggleRule(rule.id), rule.id))}
                        </View>
                    )}

                    <View style={styles.field}>
                        <SectionLabel style={styles.label}>{t('moderation.comment')}</SectionLabel>
                        <TextInput
                            value={comment}
                            onChangeText={setComment}
                            placeholder={t('moderation.commentPlaceholder')}
                            placeholderTextColor={colors.textMuted}
                            accessibilityLabel={t('moderation.comment')}
                            multiline
                            style={[type.body, styles.input, { color: colors.textPrimary, backgroundColor: colors.inputBackground }]}
                        />
                        <Text style={[type.meta, styles.counter, { color: comment.length > REPORT_COMMENT_LIMIT ? colors.dangerColor : colors.textMuted }]}>
                            {REPORT_COMMENT_LIMIT - comment.length}
                        </Text>
                    </View>

                    {remoteServer && (
                        <View style={styles.forward}>
                            <View style={styles.choiceText}>
                                <Text style={[type.name, { color: colors.textPrimary }]}>{t('moderation.forward', { server: remoteServer })}</Text>
                                <Text style={[type.meta, { color: colors.textMuted }]}>{t('moderation.forwardHint')}</Text>
                            </View>
                            <ThemedSwitch value={forward} onValueChange={setForward} accessibilityLabel={t('moderation.forward', { server: remoteServer })} />
                        </View>
                    )}

                    {failed && (
                        <Text accessibilityRole="alert" style={[type.body, { color: colors.dangerColor }]}>{t('moderation.failed')}</Text>
                    )}
                    <PillButton label={t('moderation.send')} icon="flag-outline" onPress={send} disabled={!canSend} loading={sending} style={styles.send} />
                </ScrollView>
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
    content: {
        gap: space.lg,
        padding: space.lg,
        paddingBottom: TAB_BAR_CLEARANCE,
    },
    field: {
        gap: space.sm,
    },
    label: {
        marginHorizontal: space.xs,
    },
    choice: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        minHeight: 52,
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
        borderRadius: radii.input,
        borderWidth: StyleSheet.hairlineWidth,
    },
    choiceText: {
        flex: 1,
        gap: 2,
    },
    input: {
        minHeight: 100,
        padding: space.md,
        borderRadius: radii.input,
        textAlignVertical: 'top',
    },
    counter: {
        alignSelf: 'flex-end',
    },
    forward: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
    },
    send: {
        alignSelf: 'flex-start',
    },
    sent: {
        alignItems: 'center',
        gap: space.sm,
        paddingVertical: space.lg,
    },
    centered: {
        textAlign: 'center',
    },
    buttons: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: space.sm,
    },
});

export default Report;
