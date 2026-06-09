import React, { useState } from 'react';
import { Avatar, View, Text, Button, Image, TouchableOpacity } from 'react-native-ui-lib';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Status, CustomEmoji, Attachment } from '../../services/mastodon/types';
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
    } else if (diffSec < 60) {
        return `${diffMin}m`;
    } else if (diffHr < 24) {
        return `${diffHr}h`;
    } else {
        return `${diffDays}d`;
    }
}

const renderTextWithEmojis = (
    text: string,
    emojis: CustomEmoji[],
    textStyle: any,
    emojiSize: number = 16
) => {
    if (!text) {
        return null;
    } else if (!emojis || emojis.length === 0) {
        return <Text style={textStyle}>{text}</Text>
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
                            <Image key={index} source={{ uri: emoji.url }} style={{ width: emojiSize, height: emojiSize, resizeMode: 'contain' }} />
                        )
                    }
                }
                return <React.Fragment key={index}>{part}</React.Fragment>
            })}
        </Text>
    );
};

interface TootCardProps {
    status: Status;
}

export const TootCard: React.FC<TootCardProps> = ({ status }) => {
    const isReblog = !!status.reblog;
    const targetStatus = isReblog ? status.reblog! : status;

    const [isSpoilerCollapsed, setIsSpoilerCollapsed] = useState(targetStatus.sensitive);
    const [isFavorited, setIsFavorited] = useState(targetStatus.favourited);
    const [isReblogged, setIsreblogged] = useState(targetStatus.reblogged);
    const [favCount, setFavCount] = useState(targetStatus.favourites_count);
    const [boostCount, setBoostCount] = useState(targetStatus.reblogs_count);

    const toggleFavorite = () => {
        setIsFavorited(!isFavorited);
        setFavCount((prev) => (isReblogged ? prev - 1 : prev + 1));
    }

    const toggleReblog = () => {
        setIsreblogged(!isReblogged);
        setBoostCount((prev) => (isReblogged ? prev - 1 : prev + 1));
    }

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
            )
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
        <View style={styles.cardContainer}>
            {/* boost header */}
            {isReblog && (
                <View style={styles.boostedHeader}>
                    <Ionicons name="repeat" size={14} color="#94A3B8" />
                    <Text style={styles.boostedText}>
                        {status.account.display_name || status.account.username} boosted
                    </Text>
                </View>
            )}
            {/* author */}
            <View style={styles.headerRow}>
                <View style={styles.userInfo}>
                    <Avatar source={{ uri: targetStatus.account.avatar }} size={44} />
                    <View style={styles.namesContainer}>
                        <View style={styles.nameRow}>
                            {renderTextWithEmojis(
                                targetStatus.account.display_name || targetStatus.account.username,
                                targetStatus.account.emojis,
                                styles.displayName
                            )}
                        </View>
                        <Text style={styles.username} numberOfLines={1}>
                            @{targetStatus.account.username}
                        </Text>
                    </View>
                </View>
                <Text style={styles.timeText}>{getRelativeTime(targetStatus.created_at)}</Text>
            </View>
            {targetStatus.sensitive && targetStatus.spoiler_text && (
                <View style={styles.spoilerContainer}>
                    <Text style={styles.spoilerText} numberOfLines={1}>
                        CW: {targetStatus.spoiler_text}
                    </Text>
                    <Button
                        label={isSpoilerCollapsed ? 'Show' : 'Hide'}
                        size={Button.sizes.xSmall}
                        backgroundColor={isSpoilerCollapsed ? '#4F46E5' : '#475569'}
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
                        styles.contentText
                    )}
                </View>
            )}

            {/* media */}
            {(!targetStatus.sensitive || !isSpoilerCollapsed) && (
                renderMedia(targetStatus.media_attachments)
            )}

            {/* action buttons */}
            <View style={styles.actionRow}>
                {/* TODO: add reply action */}
                <TouchableOpacity style={styles.actionButton}>
                    <Ionicons name="chatbubble-outline" size={18} color="#64748B" />
                    <Text style={styles.actionCount}>{targetStatus.replies_count || 0}</Text>
                </TouchableOpacity>
                {/* reblog */}
                <TouchableOpacity style={styles.actionButton} onPress={toggleReblog}>
                    <Ionicons name="repeat" size={18} color={isReblogged ? '#10B981' : '#64748B'} />
                    <Text style={[styles.actionCount, isReblogged && { color: '#10B981' }]}>
                        {boostCount || 0}
                    </Text>
                </TouchableOpacity>
                {/* favourite */}
                <TouchableOpacity style={styles.actionButton} onPress={toggleFavorite}>
                    <Ionicons name={isFavorited ? 'heart' : 'heart-outline'} size={18} color={isFavorited ? '#EF4444' : '#64748B'} />
                    <Text style={[styles.actionCount, isFavorited && { color: '#EF4444' }]}>{favCount || 0}</Text>
                </TouchableOpacity>
                {/* share */}
                <TouchableOpacity style={styles.actionButton}>
                    <Ionicons name="share-social-outline" size={18} color="#64748B" />
                </TouchableOpacity>
            </View>
        </View>
    )
}