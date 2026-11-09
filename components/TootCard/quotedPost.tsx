import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../services/themeContext';
import { useI18n } from '../../services/i18n/i18nContext';
import { TKey } from '../../services/i18n/translate';
import { renderNameWithEmojis, renderTextWithEmojis } from '../../services/emojiHelper';
import { plainText } from '../../services/htmlText';
import { QuoteNotice, quoteView } from '../../services/mastodon/quotes';
import { Mention, PreviewCard, Quote, Status } from '../../services/mastodon/types';
import { openLink } from '../../services/links';
import { radii, space } from '../../services/theme/shape';
import { Avatar } from '../ui';
import { FocusedImage } from './focusedImage';
import { PARAGRAPH_GAP, StatusHtmlContent } from './htmlContent';

const MAX_THUMBS = 4;
// Longer quotes are cut here; tapping the card opens the whole post
const MAX_LINES = 6;
const AVATAR = 32;

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
    // Opens the quoted post; without it the card is read-only (as in compose)
    onOpen?: (status: Status) => void;
    // "3h", "Mon": the same relative time the card shows; without it, no time
    timeOf?: (createdAt: string) => string;
    compactMode?: boolean;
    // Links in the quoted text, as in the post around it; without them links open in the browser
    onPressLink?: (href: string) => void;
    onPressHashtag?: (tag: string) => void;
    onPressMention?: (href: string, mentions?: Mention[]) => void;
    // The link preview as the post around it draws one; without it the quote shows none (as in compose)
    renderLinkPreview?: (card: PreviewCard) => React.ReactNode;
}

// The post a post quotes, as a small card inside it; tapping opens it. Quotes that can't be shown
// (waiting for approval, removed, deleted…) say why instead.
export const QuotedPost: React.FC<QuotedPostProps> = ({ quote, onOpen, timeOf, compactMode = false, onPressLink = openLink, onPressHashtag, onPressMention, renderLinkPreview }) => {
    const { colors, type } = useTheme();
    const { t } = useI18n();
    const { width } = useWindowDimensions();
    const view = quoteView(quote);
    // Mentions resolve against the quoted post's own list
    const mentions = view?.kind === 'post' ? view.status.mentions : undefined;
    const pressMention = useCallback(
        (href: string) => (onPressMention ? onPressMention(href, mentions) : onPressLink(href)),
        [onPressMention, onPressLink, mentions]
    );
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
            onPress={onOpen ? () => onOpen(status) : undefined}
            disabled={!onOpen}
            accessibilityRole={onOpen ? 'button' : undefined}
            accessibilityLabel={t('quotes.openQuoted', { name, text: status.spoiler_text || text })}
            style={({ pressed }) => [styles.box, { borderColor: colors.borderColor, backgroundColor: colors.inputBackground }, pressed && styles.pressed]}
        >
            {/* Laid out like a post's own header: name over handle, time on the right */}
            <View style={styles.author}>
                <Avatar name={name} uri={status.account.avatar} size={AVATAR} />
                <View style={styles.names}>
                    {renderNameWithEmojis(name, status.account.emojis ?? [], [type.name, { color: colors.textPrimary }], 15)}
                    <Text style={[type.meta, { color: colors.textMuted }]} numberOfLines={1}>@{status.account.acct}</Text>
                </View>
                {timeOf && <Text style={[type.meta, { color: colors.textMuted }]}>{timeOf(status.created_at)}</Text>}
            </View>

            {status.spoiler_text ? (
                <View style={styles.warning}>
                    <Ionicons name="warning-outline" size={14} color={colors.accentText} />
                    <Text style={[type.body, styles.text, { color: colors.textSecondary }]} numberOfLines={2}>
                        {renderTextWithEmojis(status.spoiler_text, status.emojis ?? [], [type.body, styles.text, { color: colors.textSecondary }], 14)}
                    </Text>
                </View>
            ) : (
                // The post's own HTML, so links are shortened and tappable like in the post around it
                !!text && (
                    <View style={[styles.textFold, { maxHeight: MAX_LINES * (compactMode ? 18 : 22.5) }]}>
                        {/* Without the gap under the last paragraph, which the card's padding already gives */}
                        <View style={styles.lastGap}>
                            <StatusHtmlContent
                                content={status.content}
                                emojis={status.emojis ?? []}
                                colors={colors}
                                bodyFont={type.body}
                                compactMode={compactMode}
                                width={width}
                                onPressMention={pressMention}
                                onPressHashtag={onPressHashtag}
                                onPressLink={onPressLink}
                            />
                        </View>
                    </View>
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
                            <FocusedImage
                                key={item.id}
                                attachment={item}
                                style={[styles.thumb, media.length === 1 && styles.wide, { backgroundColor: colors.cardBackground }]}
                            />
                        ))}
                    </View>
                ))}

            {/* Not under a content warning: it would give away what's behind it */}
            {status.card && !status.spoiler_text && renderLinkPreview?.(status.card)}

            {status.poll && (
                <View style={styles.warning}>
                    <Ionicons name="stats-chart-outline" size={14} color={colors.textMuted} />
                    <Text style={[type.meta, { color: colors.textMuted }]}>{t('quotes.hasPoll')}</Text>
                </View>
            )}

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
    },
    textFold: {
        overflow: 'hidden',
    },
    lastGap: {
        marginBottom: -PARAGRAPH_GAP,
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
    // Side by side across the card; one picture gets a wide tile
    thumb: {
        flex: 1,
        aspectRatio: 1,
        borderRadius: radii.input,
        overflow: 'hidden',
    },
    wide: {
        aspectRatio: 16 / 9,
    },
});
