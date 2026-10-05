import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '../../services/themeContext';
import { useI18n } from '../../services/i18n/i18nContext';
import { getStatusHistory } from '../../services/mastodon/statuses';
import { plainText } from '../../services/htmlText';
import { space } from '../../services/theme/shape';
import { Well } from '../ui';
import { BottomSheet } from '../ComposeModal/optionSheet';

interface EditHistorySheetProps {
    visible: boolean;
    statusId: string;
    onClose: () => void;
    // "3h", "Mon": the same relative time the card shows
    timeOf: (createdAt: string) => string;
}

// Every version of an edited post, newest first
export const EditHistorySheet: React.FC<EditHistorySheetProps> = ({ visible, statusId, onClose, timeOf }) => {
    const { colors, type } = useTheme();
    const { t, tn } = useI18n();
    const { data, isError } = useQuery({ queryKey: ['statusHistory', statusId], queryFn: () => getStatusHistory(statusId), enabled: visible });
    const versions = data ? [...data].reverse() : [];

    return (
        <BottomSheet visible={visible} title={t('posts.historyTitle')} onClose={onClose}>
            {!data && !isError && <ActivityIndicator color={colors.accentColor} style={styles.loading} />}
            {isError && <Text style={[type.body, { color: colors.textMuted }]}>{t('posts.historyFailed')}</Text>}
            <ScrollView contentContainerStyle={styles.list} bounces={false}>
                {versions.map((version, index) => (
                    <Well key={version.created_at} style={styles.version}>
                        <Text style={[type.label, { color: colors.textSecondary }]}>
                            {index === versions.length - 1 ? t('posts.original') : t('posts.editedAt', { time: timeOf(version.created_at) })}
                        </Text>
                        {!!version.spoiler_text && (
                            <Text style={[type.name, { color: colors.textSecondary }]}>{t('notifications.cw', { text: version.spoiler_text })}</Text>
                        )}
                        <Text style={[type.body, { color: colors.textPrimary }]}>{plainText(version.content)}</Text>
                        {version.media_attachments.length > 0 && (
                            <Text style={[type.meta, { color: colors.textMuted }]}>{tn('posts.historyMedia', version.media_attachments.length)}</Text>
                        )}
                    </Well>
                ))}
            </ScrollView>
        </BottomSheet>
    );
};

const styles = StyleSheet.create({
    loading: {
        paddingVertical: space.lg,
    },
    list: {
        gap: space.sm,
        paddingBottom: space.sm,
    },
    version: {
        gap: space.xs,
    },
});
