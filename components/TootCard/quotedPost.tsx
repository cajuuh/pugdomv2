import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../services/themeContext';
import { useI18n } from '../../services/i18n/i18nContext';
import { TKey } from '../../services/i18n/translate';
import { renderTextWithEmojis } from '../../services/emojiHelper';
import { plainText } from '../../services/htmlText';
import { QuoteNotice, quoteView } from '../../services/mastodon/quotes';
import { Quote, Status } from '../../services/mastodon/types';
import { radii, space } from '../../services/theme/shape';
import { Avatar } from '../ui';
import { FocusedImage } from './focusedImage';

const THUMB = 56;
const MAX_THUMBS = 4;

const NOTICES: Record<QuoteNotice, { icon: React.ComponentProps<typeof Ionicons>['name']; text: TKey }> = {
    pending: { icon: 'hourglass-outline', text: 'quotes.pending' },
    removed: { icon: 'remove-circle-outline', text: 'quotes.removed' },
    deleted: { icon: 'trash-outline', text: 'quotes.deleted' },
    unavailable: { icon: 'lock-closed-outline', text: 'quotes.unavailable' },
    blocked: { icon: 'hand-left-outline', text: 'quotes.blocked' },
    muted: { icon: 'volume-mute-outline', text: 'quotes.muted' },
};

interface QuotedPostProps {
    quote: Quote;
    // Opens the quoted post
    onOpen: (status: Status) => void;
    // "3h", "Mon": the same relative time the card shows
    timeOf: (createdAt: string) => string;
}

// The post a post quotes, as a small card inside it; tapping opens it. Quotes that can't be shown
// (waiting for approval, removed, deleted…) say why instead.
export const QuotedPost: React.FC<QuotedPostProps> = ({ quote, onOpen, timeOf }) => {
    const { colors, type } = useTheme();
    const { t } = useI18n();
    const view = quoteView(quote);
    if (!view) return null;

    if (view.kind === 'notice') {
        const notice = NOTICES[view.notice];
        return (
            <View style={[styles.box, styles.notice, { borderColor: colors.borderColor }]} accessible accessibilityLabel={t(notice.text)}>
                <Ionicons name={notice.icon} size={16} color={colors.textMuted} />
                <Text style={[type.meta, styles.noticeText, { color: colors.textMuted }]}>{t(notice.text)}</Text>
            </View>
        );
    }

    const status = view.status;
    const name = status.account.display_name || status.account.username;
    const text = plainText(status.content);
    const media = status.media_attachments ?? [];
    const hideMedia = status.sensitive || !!status.spoiler_text;
    const nested = !!status.quote;

    return (
        <Pressable
            onPress={() => onOpen(status)}
            accessibilityRole="button"
            accessibilityLabel={t('quotes.openQuoted', { name, text: status.spoiler_text || text })}
            style={({ pressed }) => [styles.box, { borderColor: colors.borderColor, backgroundColor: colors.inputBackground }, pressed && styles.pressed]}
        >
            <View style={styles.author}>
                <Avatar name={name} uri={status.account.avatar} size={20} />
                <View style={styles.names}>
                    {renderTextWithEmojis(name, status.account.emojis ?? [], [type.name, styles.name, { color: colors.textPrimary }], 13)}
                    <Text style={[type.meta, styles.handle, { color: colors.textMuted }]} numberOfLines={1}>
                        @{status.account.acct} · {timeOf(status.created_at)}
                    </Text>
                </View>
            </View>

            {status.spoiler_text ? (
                <View style={styles.warning}>
                    <Ionicons name="warning-outline" size={14} color={colors.accentText} />
                    <Text style={[type.body, styles.text, { color: colors.textSecondary }]} numberOfLines={2}>
                        {status.spoiler_text}
                    </Text>
                </View>
            ) : (
                !!text && (
                    <Text style={[type.body, styles.text, { color: colors.textPrimary }]} numberOfLines={6}>
                        {renderTextWithEmojis(text, status.emojis ?? [], [type.body, styles.text, { color: colors.textPrimary }], 14)}
                    </Text>
                )
            )}

            {media.length > 0 &&
                (hideMedia ? (
                    <View style={styles.warning}>
                        <Ionicons name="eye-off-outline" size={14} color={colors.textMuted} />
                        <Text style={[type.meta, { color: colors.textMuted }]}>{t('quotes.hiddenMedia')}</Text>
                    </View>
                ) : (
                    <View style={styles.thumbs}>
                        {media.slice(0, MAX_THUMBS).map(item => (
                            <FocusedImage key={item.id} attachment={item} style={[styles.thumb, { backgroundColor: colors.cardBackground }]} />
                        ))}
                    </View>
                ))}

            {nested && (
                <View style={styles.warning}>
                    <Ionicons name="return-down-forward-outline" size={14} color={colors.textMuted} />
                    <Text style={[type.meta, { color: colors.textMuted }]}>{t('quotes.quotesAnother')}</Text>
                </View>
            )}
        </Pressable>
    );
};

const styles = StyleSheet.create({
    box: {
        marginTop: space.sm,
        padding: space.md,
        gap: space.sm,
        borderRadius: radii.well,
        borderWidth: StyleSheet.hairlineWidth,
    },
    pressed: {
        opacity: 0.7,
    },
    notice: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    noticeText: {
        flex: 1,
    },
    author: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
    },
    names: {
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
    },
    name: {
        fontSize: 13,
        flexShrink: 1,
    },
    handle: {
        flexShrink: 1,
    },
    text: {
        fontSize: 14,
        lineHeight: 20,
    },
    warning: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
    },
    thumbs: {
        flexDirection: 'row',
        gap: space.xs,
    },
    thumb: {
        width: THUMB,
        height: THUMB,
        borderRadius: radii.input,
    },
});
