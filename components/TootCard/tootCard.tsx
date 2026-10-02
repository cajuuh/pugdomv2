import React, { useRef } from 'react';
import { Alert, Image, Platform, Pressable, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { useRecyclingState } from '@shopify/flash-list';
import { Status, Attachment, PreviewCard } from '../../services/mastodon/types';
import { StatusHtmlContent, openLink } from './htmlContent';
import { useSettings } from '../../services/settingsContext';
import { useTheme } from '../../services/themeContext';
import { useCompose } from '../../services/composeContext';
import {
    CARD_MARGIN,
    CARD_PADDING,
    COMPACT_ACTION_HEIGHT,
    COMPACT_ACTION_ICON,
    COMPACT_AVATAR,
    COMPACT_PADDING,
    THREAD_AVATAR_GAP,
    makeStyles,
} from './styles';
import { useThemedStyles } from '../../services/theme/useThemedStyles';
import { favouriteStatus, unfavouriteStatus, reblogStatus, unreblogStatus } from '../../services/mastodon/statuses';
import { Poll } from '../Poll/poll';
import { Avatar, Card, PillButton } from '../ui';
import { renderTextWithEmojis } from '../../services/emojiHelper';
import { useUpdateCachedStatus } from '../../hooks/useUpdateCachedStatus';
import { useMediaViewer } from '../MediaViewer/mediaViewer';
import { hitSlopFor } from '../../services/theme/shape';

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

// Alt text when the author wrote one, otherwise the media's position in the post
const MEDIA_KIND: Record<Attachment['type'], string> = { image: 'Image', video: 'Video', gifv: 'GIF', unknown: 'Attachment' };
const mediaLabel = (attachment: Attachment, index: number, count: number) =>
    attachment.description || `${MEDIA_KIND[attachment.type] ?? 'Attachment'} ${index + 1} of ${count}`;

// "1 photo", "3 videos", "2 attachments" (mixed kinds)
export const countMedia = (attachments: Attachment[]) => {
    const nouns = new Set(attachments.map(a => (a.type === 'image' ? 'photo' : a.type === 'video' || a.type === 'gifv' ? 'video' : 'attachment')));
    const noun = nouns.size === 1 ? [...nouns][0] : 'attachment';
    return `${attachments.length} ${noun}${attachments.length === 1 ? '' : 's'}`;
};

const hasText = (html: string) => html.replace(/<[^>]*>/g, '').trim().length > 0;

// What a collapsed content warning hides, e.g. "Text and 2 photos hidden"
export const describeHidden = (status: Status) => {
    const parts: string[] = [];
    if (hasText(status.content)) parts.push('text');
    if (status.poll) parts.push('a poll');
    if (status.media_attachments?.length) parts.push(countMedia(status.media_attachments));
    if (status.card) parts.push('a link');
    if (parts.length === 0) return null;
    const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
    return `${list.charAt(0).toUpperCase()}${list.slice(1)} hidden`;
};

const getDomainName = (urlStr: string) => {
    try {
        const matches = urlStr.match(/^https?:\/\/([^/?#]+)(?:[/?#]|$)/i);
        return matches && matches[1] ? matches[1].replace('www.', '') : 'Link';
    } catch {
        return 'Link';
    }
};

interface TootCardProps {
    status: Status;
    onPressMention?: (acct: string) => void;
    onPressHashtag?: (hashtag: string) => void;
    // Receives the id of the status to open; for boosts that's the original, since a boost has no thread of its own
    onPress?: (statusId: string) => void;
    threadMode?: boolean;
    hasThreadLineTop?: boolean;
    hasThreadLineBottom?: boolean;
}

export const TootCard: React.FC<TootCardProps> = ({ status, onPressMention, onPressHashtag, onPress, threadMode, hasThreadLineTop, hasThreadLineBottom }) => {
    const { compactMode } = useSettings();
    const { colors, type } = useTheme();
    const styles = useThemedStyles(makeStyles);
    const { openCompose } = useCompose();
    const { width } = useWindowDimensions();
    const { openMedia } = useMediaViewer();
    const isReblog = !!status.reblog;
    const targetStatus = isReblog ? status.reblog! : status;

    const updateCachedStatus = useUpdateCachedStatus();

    // FlashList reuses this component for other statuses, so all per-status state resets when the status changes
    const recyclingDeps = [targetStatus.id];
    // Only a content warning hides the text; `sensitive` alone just veils the media
    const hasContentWarning = !!targetStatus.spoiler_text;
    const [isSpoilerCollapsed, setIsSpoilerCollapsed] = useRecyclingState(hasContentWarning, recyclingDeps);
    const [isFavorited, setIsFavorited] = useRecyclingState(targetStatus.favourited, recyclingDeps);
    const [isReblogged, setIsreblogged] = useRecyclingState(targetStatus.reblogged, recyclingDeps);
    const [favCount, setFavCount] = useRecyclingState(targetStatus.favourites_count, recyclingDeps);
    const [boostCount, setBoostCount] = useRecyclingState(targetStatus.reblogs_count, recyclingDeps);
    const [isMediaRevealed, setIsMediaRevealed] = useRecyclingState(false, recyclingDeps);

    // Lets async handlers skip state updates if the card was recycled while a request was in flight
    const renderedStatusId = useRef(targetStatus.id);
    renderedStatusId.current = targetStatus.id;

    const toggleFavorite = async () => {
        const previousIsFavorited = isFavorited;
        const previousFavCount = favCount;

        setIsFavorited(!previousIsFavorited);
        setFavCount((prev) => (previousIsFavorited ? prev - 1 : prev + 1));

        try {
            const updated = previousIsFavorited
                ? await unfavouriteStatus(targetStatus.id)
                : await favouriteStatus(targetStatus.id);
            updateCachedStatus(updated);
        } catch (error) {
            if (renderedStatusId.current !== targetStatus.id) {
                return;
            }
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
            const response = previousIsReblogged
                ? await unreblogStatus(targetStatus.id)
                : await reblogStatus(targetStatus.id);
            // Reblogging returns the new boost wrapping the original; unreblogging returns the original
            updateCachedStatus(response.reblog ?? response);
        } catch (error) {
            if (renderedStatusId.current !== targetStatus.id) {
                return;
            }
            setIsreblogged(previousIsReblogged);
            setBoostCount(previousBoostCount);
            Alert.alert('Error', 'Failed to update boost status. Please try again.');
        }
    };

    const handleShare = async () => {
        // Remote statuses may have no `url`; `uri` always points to the original post
        const link = targetStatus.url || targetStatus.uri;
        try {
            // iOS builds a link preview from `url`; Android only shares `message`
            await Share.share(Platform.OS === 'ios' ? { url: link } : { message: link });
        } catch (error) {
            console.error('Failed to share status:', error);
        }
    };

    const avatarSize = compactMode ? COMPACT_AVATAR : 42;
    const cardPadding = compactMode ? COMPACT_PADDING : CARD_PADDING;
    // Threads and Compact Mode put the avatar in its own column, beside the post
    const avatarColumn = threadMode || compactMode;
    // Width the post body gets: the card's inner width, minus the avatar column. Compact and thread cards are full width
    const bodyWidth = avatarColumn
        ? width - cardPadding * 2 - avatarSize - THREAD_AVATAR_GAP
        : width - CARD_MARGIN * 2 - cardPadding * 2;
    // The opened CW frame adds its own padding and border
    const contentWidth = hasContentWarning ? bodyWidth - 28 : bodyWidth;

    const renderMedia = (attachments: Attachment[]) => {
        if (!attachments || attachments.length === 0) {
            return null;
        }

        const count = attachments.length;
        const veiled = targetStatus.sensitive && !isMediaRevealed;
        const tiles = count === 1 ? (
            <Pressable
                style={[styles.singleMedia, compactMode && styles.singleMediaCompact]}
                onPress={() => openMedia(attachments, 0)}
                accessibilityRole="imagebutton"
                accessibilityLabel={mediaLabel(attachments[0], 0, count)}
            >
                <Image source={{ uri: attachments[0].preview_url || attachments[0].url }} style={styles.mediaImage} resizeMode="cover" />
            </Pressable>
        ) : (
            <View style={styles.mediaGrid}>
                {attachments.map((item, idx) => (
                    <Pressable
                        key={item.id || idx}
                        style={[styles.gridMedia, compactMode && styles.gridMediaCompact, { width: count === 2 ? '48%' : '31%' }]}
                        onPress={() => openMedia(attachments, idx)}
                        accessibilityRole="imagebutton"
                        accessibilityLabel={mediaLabel(item, idx, count)}
                    >
                        <Image source={{ uri: item.preview_url || item.url }} style={styles.mediaImage} resizeMode="cover" />
                    </Pressable>
                ))}
            </View>
        );

        if (!targetStatus.sensitive) {
            return tiles;
        }

        return (
            <View style={styles.mediaFrame}>
                {/* Hidden media stays out of the accessibility tree until it's shown */}
                <View importantForAccessibility={veiled ? 'no-hide-descendants' : 'auto'} accessibilityElementsHidden={veiled}>
                    {tiles}
                </View>
                {veiled ? (
                    <View style={StyleSheet.absoluteFill}>
                        <BlurView intensity={80} tint="default" style={StyleSheet.absoluteFill} />
                        <View style={styles.veil}>
                            <View style={styles.veilLabel}>
                                <Ionicons name="eye-off-outline" size={16} color={colors.textPrimary} />
                                <Text style={[type.name, styles.veilText]}>Sensitive · {countMedia(attachments)}</Text>
                            </View>
                            <PillButton label="Show" size="small" variant="secondary" onPress={() => setIsMediaRevealed(true)} />
                        </View>
                    </View>
                ) : (
                    <Pressable
                        style={styles.hideMediaChip}
                        onPress={() => setIsMediaRevealed(false)}
                        accessibilityRole="button"
                        accessibilityLabel="Hide media"
                        hitSlop={6}
                    >
                        <Ionicons name="eye-off-outline" size={16} color={colors.textPrimary} />
                    </Pressable>
                )}
            </View>
        );
    };

    const renderLinkPreview = (card: PreviewCard) => {
        const domain = getDomainName(card.url);
        // Compact Mode skips the thumbnail: a title + domain row
        if (!card.image || compactMode) {
            return (
                <Pressable style={[styles.linkPlain, compactMode && styles.linkPlainCompact]} onPress={() => openLink(card.url)} accessibilityRole="link" accessibilityLabel={card.title || domain}>
                    <View style={styles.linkIconBox}>
                        <Ionicons name="link" size={18} color={colors.accentText} />
                    </View>
                    <View style={styles.linkBody}>
                        <Text style={[type.name, styles.linkTitle]} numberOfLines={1}>{card.title || domain}</Text>
                        <Text style={[type.meta, styles.linkMeta]} numberOfLines={1}>{compactMode ? domain : card.description || domain}</Text>
                    </View>
                </Pressable>
            );
        }
        return (
            <Pressable style={styles.linkPreview} onPress={() => openLink(card.url)} accessibilityRole="link" accessibilityLabel={card.title || domain}>
                <View style={styles.linkThumb}>
                    <Image source={{ uri: card.image }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                </View>
                <View style={styles.linkBody}>
                    <Text style={[type.label, styles.linkProvider]} numberOfLines={1}>{card.provider_name || domain}</Text>
                    <Text style={[type.name, styles.linkTitle]} numberOfLines={2}>{card.title}</Text>
                    {card.description ? (
                        <Text style={[type.meta, styles.linkMeta]} numberOfLines={1}>{card.description}</Text>
                    ) : null}
                </View>
            </Pressable>
        );
    };

    const body = (
        <>
            {hasText(targetStatus.content) && (
                <StatusHtmlContent
                    content={targetStatus.content}
                    emojis={targetStatus.emojis}
                    colors={colors}
                    bodyFont={type.body}
                    compactMode={compactMode}
                    width={contentWidth}
                    onPressMention={onPressMention}
                    onPressHashtag={onPressHashtag}
                    onPressLink={openLink}
                />
            )}
            {targetStatus.poll && (
                <Poll
                    initialPoll={targetStatus.poll}
                    onPollUpdated={(poll) => updateCachedStatus({ ...targetStatus, poll })}
                />
            )}
            {renderMedia(targetStatus.media_attachments)}
            {targetStatus.card && renderLinkPreview(targetStatus.card)}
        </>
    );

    const renderContent = () => {
        if (!hasContentWarning) {
            return <View style={[styles.content, compactMode && styles.contentCompact]}>{body}</View>;
        }
        if (isSpoilerCollapsed) {
            const hidden = describeHidden(targetStatus);
            return (
                <View style={styles.cwRibbon}>
                    <Ionicons name="warning-outline" size={22} color={colors.accentText} />
                    <View style={styles.cwText}>
                        <Text style={[type.label, styles.cwLabel]}>Content warning</Text>
                        <Text style={[type.name, styles.cwSpoiler]}>{targetStatus.spoiler_text}</Text>
                        {hidden && <Text style={[type.meta, styles.cwHidden]}>{hidden}</Text>}
                    </View>
                    <PillButton label="Show" variant="secondary" onPress={() => setIsSpoilerCollapsed(false)} />
                </View>
            );
        }
        return (
            <View style={styles.cwFrame}>
                <View style={styles.cwFrameHeader}>
                    <Text style={[type.name, styles.cwFrameTitle]} numberOfLines={2}>CW · {targetStatus.spoiler_text}</Text>
                    <PillButton label="Hide" size="small" variant="subtle" onPress={() => setIsSpoilerCollapsed(true)} />
                </View>
                <View style={styles.cwFrameContent}>{body}</View>
            </View>
        );
    };

    const displayName = renderTextWithEmojis(
        targetStatus.account.display_name || targetStatus.account.username,
        targetStatus.account.emojis,
        [type.name, styles.displayName, compactMode && { fontSize: 13 }],
        compactMode ? 13 : 15
    );
    const names = (
        <View style={[styles.names, compactMode && styles.namesInline]}>
            {displayName}
            <Text style={[type.meta, styles.handle, compactMode && styles.handleInline]} numberOfLines={1}>@{targetStatus.account.acct}</Text>
        </View>
    );
    const time = <Text style={[type.meta, styles.time]}>{getRelativeTime(targetStatus.created_at)}</Text>;
    const avatar = (
        <Avatar
            name={targetStatus.account.display_name || targetStatus.account.username}
            uri={targetStatus.account.avatar}
            size={avatarSize}
        />
    );

    // Compact buttons are shorter but keep a MIN_TOUCH hit area
    const actionIcon = compactMode ? COMPACT_ACTION_ICON : 20;
    const actionButtonStyle = [styles.actionButton, compactMode && styles.actionButtonCompact];
    const actionHitSlop = compactMode ? hitSlopFor(44, COMPACT_ACTION_HEIGHT) : undefined;
    const actions = (
        <View style={[styles.actionRow, compactMode && styles.actionRowCompact]}>
            <Pressable
                style={actionButtonStyle}
                hitSlop={actionHitSlop}
                onPress={() => openCompose({ replyToStatus: targetStatus })}
                accessibilityRole="button"
                accessibilityLabel={`Reply, ${targetStatus.replies_count || 0} replies`}
            >
                <Ionicons name="arrow-undo-outline" size={actionIcon} color={colors.textMuted} />
                <Text style={[type.meta, styles.actionCount]}>{targetStatus.replies_count || 0}</Text>
            </Pressable>
            <Pressable
                style={actionButtonStyle}
                hitSlop={actionHitSlop}
                onPress={toggleReblog}
                accessibilityRole="button"
                accessibilityLabel={`${isReblogged ? 'Boosted' : 'Boost'}, ${boostCount || 0} boosts`}
                accessibilityState={{ selected: isReblogged }}
            >
                <Ionicons name="repeat" size={actionIcon} color={isReblogged ? colors.accentText : colors.textMuted} />
                <Text style={[type.meta, styles.actionCount, isReblogged && styles.actionCountActive]}>{boostCount || 0}</Text>
            </Pressable>
            <Pressable
                style={actionButtonStyle}
                hitSlop={actionHitSlop}
                onPress={toggleFavorite}
                accessibilityRole="button"
                accessibilityLabel={`${isFavorited ? 'Favourited' : 'Favourite'}, ${favCount || 0} favourites`}
                accessibilityState={{ selected: isFavorited }}
            >
                <Ionicons name={isFavorited ? 'star' : 'star-outline'} size={actionIcon} color={isFavorited ? colors.accentText : colors.textMuted} />
                <Text style={[type.meta, styles.actionCount, isFavorited && styles.actionCountActive]}>{favCount || 0}</Text>
            </Pressable>
            <Pressable style={actionButtonStyle} hitSlop={actionHitSlop} onPress={handleShare} accessibilityRole="button" accessibilityLabel="Share">
                <Ionicons name="share-outline" size={actionIcon} color={colors.textMuted} />
            </Pressable>
        </View>
    );

    const card = (
        <Card style={[styles.card, compactMode && styles.cardCompact, threadMode && styles.cardThread]}>
            {isReblog && (
                <View style={[styles.boostRow, compactMode && styles.boostRowCompact]}>
                    <Ionicons name="repeat" size={14} color={colors.textMuted} />
                    <Avatar name={status.account.display_name || status.account.username} uri={status.account.avatar} size={18} />
                    {renderTextWithEmojis(
                        (status.account.display_name || status.account.username) + ' boosted',
                        status.account.emojis || [],
                        [type.meta, styles.boostText],
                        12.5
                    )}
                </View>
            )}

            {avatarColumn ? (
                // The avatar keeps its own column: in a thread the connecting lines run through it
                <View style={styles.threadRow}>
                    <View style={[styles.threadAvatarColumn, { width: avatarSize }]}>
                        {hasThreadLineTop && (
                            <View style={[styles.threadLine, { top: -cardPadding, height: cardPadding + avatarSize / 2 }]} />
                        )}
                        {hasThreadLineBottom && (
                            <View style={[styles.threadLine, { top: avatarSize / 2, bottom: -cardPadding }]} />
                        )}
                        {avatar}
                    </View>
                    <View style={styles.threadBody}>
                        <View style={styles.authorRow}>
                            {names}
                            {time}
                        </View>
                        {renderContent()}
                        {actions}
                    </View>
                </View>
            ) : (
                <>
                    <View style={styles.authorRow}>
                        {avatar}
                        {names}
                        {time}
                    </View>
                    {renderContent()}
                    {actions}
                </>
            )}
        </Card>
    );

    if (!onPress) {
        return card;
    }
    return (
        <Pressable onPress={() => onPress(targetStatus.id)} accessibilityHint="Opens the thread">
            {card}
        </Pressable>
    );
};
