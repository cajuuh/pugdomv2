import React, { useState } from 'react';
import { Alert, Image as RNImage } from 'react-native';
import { Avatar, View, Text, Button, Image, TouchableOpacity } from 'react-native-ui-lib';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as WebBrowser from 'expo-web-browser';
import { Status, CustomEmoji, Attachment } from '../../services/mastodon/types';
import { useSettings } from '../../services/settingsContext';
import { useTheme } from '../../services/themeContext';
import { useCompose } from '../../services/composeContext';
import { styles } from './styles';
import { favouriteStatus, unfavouriteStatus, reblogStatus, unreblogStatus } from '../../services/mastodon/statuses';

type ParsedPart = {
    type: 'text' | 'link' | 'mention' | 'hashtag';
    content: string;
    href?: string;
    acct?: string;
    tag?: string;
};

export const parseStatusHtml = (html: string): ParsedPart[] => {
    if (!html) return [];
    
    let text = html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<p>/gi, '')
        .trim();
        
    const parts: ParsedPart[] = [];
    const anchorRegex = /<a\s+([^>]+)>(.*?)<\/a>/gi;
    let match;
    let lastIndex = 0;

    while ((match = anchorRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            const plainText = text.substring(lastIndex, match.index).replace(/<[^>]*>/g, '');
            if (plainText) {
                parts.push({ type: 'text', content: plainText });
            }
        }

        const attributesString = match[1];
        const innerHtml = match[2];

        const hrefMatch = attributesString.match(/href="([^"]*)"/i);
        const href = hrefMatch ? hrefMatch[1] : '';

        const classMatch = attributesString.match(/class="([^"]*)"/i);
        const className = classMatch ? classMatch[1] : '';

        let innerText = innerHtml;
        if (!className.includes('mention') && !className.includes('hashtag')) {
           innerText = innerText.replace(/<span class="invisible">.*?<\/span>/gi, '');
        }
        innerText = innerText.replace(/<[^>]*>/g, '');

        let type: ParsedPart['type'] = 'link';
        let acct: string | undefined;
        let tag: string | undefined;

        if (className.includes('mention')) {
            type = 'mention';
            acct = innerText.replace(/^@/, '');
        } else if (className.includes('hashtag')) {
            type = 'hashtag';
            tag = innerText.replace(/^#/, '');
        }

        parts.push({ type, href, content: innerText, acct, tag });
        lastIndex = anchorRegex.lastIndex;
    }

    if (lastIndex < text.length) {
        const plainText = text.substring(lastIndex).replace(/<[^>]*>/g, '');
        if (plainText) {
            parts.push({ type: 'text', content: plainText });
        }
    }

    if (parts.length === 0) {
        parts.push({ type: 'text', content: text.replace(/<[^>]*>/g, '') });
    }

    return parts;
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

export const renderStatusContent = (
    html: string,
    emojis: CustomEmoji[],
    textStyle: any,
    linkStyle: any,
    onPressLink: (part: ParsedPart) => void
) => {
    const parts = parseStatusHtml(html);
    return (
        <Text style={textStyle}>
            {parts.map((part, index) => {
                const emojiRegex = /(:[a-zA-Z0-9_]+:)/g;
                const tokens = part.content.split(emojiRegex);
                
                const contentNodes = tokens.map((token, tIndex) => {
                    if (token.startsWith(':') && token.endsWith(':')) {
                        const shortcode = token.slice(1, -1);
                        const emoji = emojis?.find((e) => e.shortcode === shortcode);
                        if (emoji) {
                            return (
                                <RNImage
                                    key={`emoji-${index}-${tIndex}`}
                                    source={{ uri: emoji.url }}
                                    style={{ width: 16, height: 16, resizeMode: 'contain' }}
                                />
                            );
                        }
                    }
                    return <React.Fragment key={`text-${index}-${tIndex}`}>{token}</React.Fragment>;
                });

                if (part.type === 'text') {
                    return <React.Fragment key={`part-${index}`}>{contentNodes}</React.Fragment>;
                } else {
                    return (
                        <Text 
                            key={`part-${index}`} 
                            style={linkStyle} 
                            onPress={() => onPressLink(part)}
                        >
                            {contentNodes}
                        </Text>
                    );
                }
            })}
        </Text>
    );
};

interface TootCardProps {
    status: Status;
    onPressMention?: (acct: string) => void;
    onPressHashtag?: (hashtag: string) => void;
}

export const TootCard: React.FC<TootCardProps> = ({ status, onPressMention, onPressHashtag }) => {
    const { compactMode } = useSettings();
    const { colors } = useTheme();
    const { openCompose } = useCompose();
    const isReblog = !!status.reblog;
    const targetStatus = isReblog ? status.reblog! : status;

    const [isSpoilerCollapsed, setIsSpoilerCollapsed] = useState(targetStatus.sensitive);
    const [isFavorited, setIsFavorited] = useState(targetStatus.favourited);
    const [isReblogged, setIsreblogged] = useState(targetStatus.reblogged);
    const [favCount, setFavCount] = useState(targetStatus.favourites_count);
    const [boostCount, setBoostCount] = useState(targetStatus.reblogs_count);

    const toggleFavorite = async () => {
        const previousIsFavorited = isFavorited;
        const previousFavCount = favCount;

        setIsFavorited(!previousIsFavorited);
        setFavCount((prev) => (previousIsFavorited ? prev - 1 : prev + 1));

        try {
            if (previousIsFavorited) {
                await unfavouriteStatus(targetStatus.id);
            } else {
                await favouriteStatus(targetStatus.id);
            }
        } catch (error) {
            setIsFavorited(previousIsFavorited);
            setFavCount(previousFavCount);
            Alert.alert('Error', 'Failed to update favorite status. Please try again.');
        }
    };

    const toggleReblog = async () => {
        const previousIsReblogged = isReblogged;
        const previousBoostCount = boostCount;

        setIsreblogged(!previousIsReblogged);
        setBoostCount((prev) => (previousIsReblogged ? prev - 1 : prev + 1));

        try {
            if (previousIsReblogged) {
                await unreblogStatus(targetStatus.id);
            } else {
                await reblogStatus(targetStatus.id);
            }
        } catch (error) {
            setIsreblogged(previousIsReblogged);
            setBoostCount(previousBoostCount);
            Alert.alert('Error', 'Failed to update boost status. Please try again.');
        }
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
                    {renderStatusContent(
                        targetStatus.content,
                        targetStatus.emojis,
                        [styles.contentText, { color: colors.textPrimary }, compactMode && { fontSize: 13, lineHeight: 18 }],
                        { color: colors.accentColor },
                        (part) => {
                            if (part.type === 'mention') {
                                if (onPressMention && part.acct) onPressMention(part.acct);
                                else if (part.href) handlePressCard(part.href);
                            } else if (part.type === 'hashtag') {
                                if (onPressHashtag && part.tag) onPressHashtag(part.tag);
                                else if (part.href) handlePressCard(part.href);
                            } else if (part.href) {
                                handlePressCard(part.href);
                            }
                        }
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
                {/* reply action */}
                <TouchableOpacity 
                    style={styles.actionButton} 
                    onPress={() => openCompose({ replyToStatus: targetStatus })}
                >
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
