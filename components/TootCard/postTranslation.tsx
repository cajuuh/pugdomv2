import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useRecyclingState } from '@shopify/flash-list';
import { Status } from '../../services/mastodon/types';
import { translateStatus, Translation } from '../../services/mastodon/statuses';
import { useInstanceConfiguration } from '../../hooks/useInstanceConfiguration';
import { useI18n } from '../../services/i18n/i18nContext';
import { Translator } from '../../services/i18n/translate';
import { useTheme } from '../../services/themeContext';
import { dialog } from '../../services/dialog';
import { space } from '../../services/theme/shape';

// "inglês", "English": the language's name in the app's language, for the common ones
export const languageName = (code: string, dict: Translator['dict']): string | undefined =>
    (dict.translation.languages as Record<string, string>)[code.split('-')[0]];

// A post in another language can be translated into the app's language, when the server translates
// (tester request). Mastodon only translates public and unlisted posts.
export const usePostTranslation = (status: Status, remote: boolean | undefined, recyclingDeps: unknown[]) => {
    const { supportsTranslation } = useInstanceConfiguration();
    const { language, t } = useI18n();
    const target = language.split('-')[0];
    const source = status.language?.split('-')[0];
    const available =
        supportsTranslation && !remote && !!source && source !== target && (status.visibility === 'public' || status.visibility === 'unlisted');
    const [shown, setShown] = useRecyclingState(false, recyclingDeps);
    // Translated once per post and language
    // The full code ("pt-BR"): Mastodon only takes its own locales, and treats "pt" as no choice (the
    // account's locale, often English)
    const query = useQuery({
        queryKey: ['translation', status.id, language],
        queryFn: () => translateStatus(status.id, language),
        enabled: available && shown,
        staleTime: Infinity,
        retry: false,
    });

    useEffect(() => {
        if (shown && query.isError) {
            setShown(false);
            dialog.toast(t('translation.failed'));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query.isError, query.errorUpdatedAt]);

    return {
        available,
        translation: shown ? query.data : undefined,
        loading: shown && !query.data,
        show: () => {
            setShown(true);
            if (query.isError) query.refetch();
        },
        hide: () => setShown(false),
    };
};

interface TranslationLineProps {
    translation?: Translation;
    loading: boolean;
    onShow: () => void;
    onHide: () => void;
}

// Under the post's text: "Translate", then where the translation came from and a way back
export const TranslationLine: React.FC<TranslationLineProps> = ({ translation, loading, onShow, onHide }) => {
    const { colors, type } = useTheme();
    const { t, dict } = useI18n();
    const link = [type.meta, { color: colors.accentText }];

    if (translation) {
        const language = languageName(translation.detected_source_language, dict);
        const source = language
            ? t('translation.from', { language, provider: translation.provider })
            : t('translation.fromUnknown', { provider: translation.provider });
        return (
            <View style={styles.row}>
                <Ionicons name="language-outline" size={14} color={colors.textMuted} />
                <Text style={[type.meta, styles.source, { color: colors.textMuted }]} numberOfLines={2}>
                    {source}
                </Text>
                <Pressable onPress={onHide} accessibilityRole="button" hitSlop={8}>
                    <Text style={link}>{t('translation.showOriginal')}</Text>
                </Pressable>
            </View>
        );
    }
    const label = t(loading ? 'translation.loading' : 'translation.translate');
    return (
        <Pressable onPress={onShow} disabled={loading} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ busy: loading }} hitSlop={8} style={styles.row}>
            <Ionicons name="language-outline" size={14} color={colors.accentText} />
            <Text style={link}>{label}</Text>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        alignSelf: 'flex-start',
        maxWidth: '100%',
    },
    source: {
        flexShrink: 1,
    },
});
