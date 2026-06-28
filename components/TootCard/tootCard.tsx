import React, { useState } from 'react';
import { Image as RNImage } from 'react-native';
import { Avatar, View, Text, Button, Image, TouchableOpacity } from 'react-native-ui-lib';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as WebBrowser from 'expo-web-browser';
import { Status, CustomEmoji, Attachment } from '../../services/mastodon/types';
import { useSettings } from '../../services/settingsContext';
import { useTheme } from '../../services/themeContext';
import { styles } from './styles';

const stripHtml = (html: string) => {
    if (!html) return '';
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<[^>]*>/g, '')
        .trim();
};

const getRelativeTime = (dateString: string) => {
    const now = new Date();
    const created = new Date(dateString);
    const diffMs = now.getTime() - created.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (diffSec < 60) {
        return 'now';
    } else if (diffMin < 60) {
        return `${diffMin}m`;
    } else if (diffHr < 24) {
        return `${diffHr}h`;
    } else {
        return `${diffDays}d`;
    }
};

const getDomainName = (urlStr: string) => {
    try {
        const matches = urlStr.match(/^https?:\/\/([^/?#]+)(?:[/?#]|$)/i);
        return matches && matches[1] ? matches[1].replace('www.', '') : 'Link';
    } catch {
        return 'Link';
    }
};

export const renderTextWithEmojis = (
    text: string,
    emojis: CustomEmoji[],
    textStyle: any,
    emojiSize: number = 16
) => {
    if (!text) {
        return null;
    } else if (!emojis || emojis.length === 0) {
        return <Text style={textStyle}>{text}</Text>;
    }

    const parts = text.split(/(:\w+:)/g);

    return (
        <Text style={textStyle}>
            {parts.map((part, index) => {
                if (part.startsWith(':') && part.endsWith(':')) {
                    const shortcode = part.slice(1, -1);
                    const emoji = emojis.find((e) => e.shortcode === shortcode);
                    if (emoji) {
                        return (
                            <RNImage
                                key={index}
                                source={{ uri: emoji.url }}
                                style={{ width: emojiSize, height: emojiSize, resizeMode: 'contain' }}
                            />
                        );
                    }
                }
                return <React.Fragment key={index}>{part}</React.Fragment>;
            })}
        </Text>
    );
};

interface TootCardProps {
    status: Status;
}

export const TootCard: React.FC<TootCardProps> = ({ status }) => {
    const { compactMode } = useSettings();
    const { colors } = useTheme();
    const isReblog = !!status.reblog;
    const targetStatus = isReblog ? status.reblog! : status;

    const [isSpoilerCollapsed, setIsSpoilerCollapsed] = useState(targetStatus.sensitive);
    const [isFavorited, setIsFavorited] = useState(targetStatus.favourited);
    const [isReblogged, setIsreblogged] = useState(targetStatus.reblogged);
    const [favCount, setFavCount] = useState(targetStatus.favourites_count);
    const [boostCount, setBoostCount] = useState(targetStatus.reblogs_count);

    const toggleFavorite = () => {
        setIsFavorited(!isFavorited);
        setFavCount((prev) => (isFavorited ? prev - 1 : prev + 1));
    };

    const toggleReblog = () => {
        setIsreblogged(!isReblogged);
        setBoostCount((prev) => (isReblogged ? prev - 1 : prev + 1));
    };

    const handlePressCard = async (url: string) => {
        try {
            await WebBrowser.openBrowserAsync(url);
        } catch (error) {
            console.error('Failed to open link:', error);
        }
    };

    const renderMedia = (attachments: Attachment[]) => {
        if (!attachments || attachments.length === 0) {
            return null;
        }

        const count = attachments.length;
        if (count === 1) {
            return (
                <View style={styles.mediaContainer}>
                    <Image
                        source={{ uri: attachments[0].preview_url || attachments[0].url }}
                        style={styles.singleMedia}
                    />
                </View>
            );
        }

        return (
            <View style={styles.mediaGrid}>
                {attachments.map((item, idx) => (
                    <Image
                        key={item.id || idx}
                        source={{ uri: item.preview_url || item.url }}
                        style={[
                            styles.gridMedia,
                            { width: count === 2 ? '48%' : '31%' }
                        ]}
                    />
                ))}
            </View>
        );
    };

    return (
        <View style={[
            styles.cardContainer,
            { backgroundColor: colors.cardBackground, borderColor: colors.borderColor },
            compactMode && { padding: 10, marginVertical: 4, marginHorizontal: 12, borderRadius: 10 }
        ]}>
            {/* boost header */}
            {isReblog && (
                <View style={styles.boostedHeader}>
                    <Ionicons name="repeat" size={14} color={colors.textMuted} />
                    <Text style={[styles.boostedText, { color: colors.textMuted }]}>
                        {status.account.display_name || status.account.username} boosted
                    </Text>
                </View>
            )}
            {/* author */}
            <View style={styles.headerRow}>
                <View style={styles.userInfo}>
                    <Avatar source={{ uri: targetStatus.account.avatar }} size={compactMode ? 32 : 44} />
                    <View style={styles.namesContainer}>
                        <View style={styles.nameRow}>
                            {renderTextWithEmojis(
                                targetStatus.account.display_name || targetStatus.account.username,
                                targetStatus.account.emojis,
                                [styles.displayName, { color: colors.textPrimary }, compactMode && { fontSize: 13 }]
                            )}
                        </View>
                        <Text style={[styles.username, { color: colors.textSecondary }]} numberOfLines={1}>
                            @{targetStatus.account.username}
                        </Text>
                    </View>
                </View>
                <Text style={[styles.timeText, { color: colors.textMuted }]}>{getRelativeTime(targetStatus.created_at)}</Text>
            </View>
            {targetStatus.sensitive && targetStatus.spoiler_text && (
                <View style={[styles.spoilerContainer, { backgroundColor: colors.background, borderColor: colors.borderColor }]}>
                    <Text style={[styles.spoilerText, { color: colors.textPrimary }]} numberOfLines={1}>
                        CW: {targetStatus.spoiler_text}
                    </Text>
                    <Button
                        label={isSpoilerCollapsed ? 'Show' : 'Hide'}
                        size={Button.sizes.xSmall}
                        backgroundColor={isSpoilerCollapsed ? colors.accentColor : colors.textMuted}
                        onPress={() => setIsSpoilerCollapsed(!isSpoilerCollapsed)}
                        labelStyle={styles.spoilerButtonLabel}
                    />
                </View>
            )}

            {/* content text */}
            {(!targetStatus.sensitive || !isSpoilerCollapsed) && (
                <View style={styles.contentContainer}>
                    {renderTextWithEmojis(
                        stripHtml(targetStatus.content),
                        targetStatus.emojis,
                        [styles.contentText, { color: colors.textPrimary }, compactMode && { fontSize: 13, lineHeight: 18 }]
                    )}
                </View>
            )}

            {/* media */}
            {(!targetStatus.sensitive || !isSpoilerCollapsed) && (
                renderMedia(targetStatus.media_attachments)
            )}

            {/* link preview */}
            {(!targetStatus.sensitive || !isSpoilerCollapsed) && targetStatus.card && (
                <TouchableOpacity
                    style={[styles.linkPreviewContainer, { backgroundColor: colors.background, borderColor: colors.borderColor }]}
                    onPress={() => handlePressCard(targetStatus.card!.url)}
                >
                    {targetStatus.card.image && (
                        <Image
                            source={{ uri: targetStatus.card.image }}
                            style={styles.linkPreviewImage}
                        />
                    )}
                    <View style={styles.linkPreviewContent}>
                        <Text style={[styles.linkPreviewProvider, { color: colors.accentColor }]}>
                            {targetStatus.card.provider_name || getDomainName(targetStatus.card.url)}
                        </Text>
                        <Text style={[styles.linkPreviewTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                            {targetStatus.card.title}
                        </Text>
                        {targetStatus.card.description ? (
                            <Text style={[styles.linkPreviewDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                                {targetStatus.card.description}
                            </Text>
                        ) : null}
                    </View>
                </TouchableOpacity>
            )}

            {/* action buttons */}
            <View style={[styles.actionRow, { borderTopColor: colors.borderColor }]}>
                {/* TODO: add reply action */}
                <TouchableOpacity style={styles.actionButton}>
                    <Ionicons name="chatbubble-outline" size={18} color={colors.textMuted} />
                    <Text style={[styles.actionCount, { color: colors.textMuted }]}>{targetStatus.replies_count || 0}</Text>
                </TouchableOpacity>
                {/* reblog */}
                <TouchableOpacity style={styles.actionButton} onPress={toggleReblog}>
                    <Ionicons name="repeat" size={18} color={isReblogged ? '#10B981' : colors.textMuted} />
                    <Text style={[styles.actionCount, { color: isReblogged ? '#10B981' : colors.textMuted }]}>
                        {boostCount || 0}
                    </Text>
                </TouchableOpacity>
                {/* favourite */}
                <TouchableOpacity style={styles.actionButton} onPress={toggleFavorite}>
                    <Ionicons name={isFavorited ? 'heart' : 'heart-outline'} size={18} color={isFavorited ? '#EF4444' : colors.textMuted} />
                    <Text style={[styles.actionCount, { color: isFavorited ? '#EF4444' : colors.textMuted }]}>{favCount || 0}</Text>
                </TouchableOpacity>
                {/* share */}
                <TouchableOpacity style={styles.actionButton}>
                    <Ionicons name="share-social-outline" size={18} color={colors.textMuted} />
                </TouchableOpacity>
            </View>
        </View>
    );
};
