import React, { useState } from 'react';
import { Alert, Image as RNImage, StyleSheet, Modal } from 'react-native';
import { Avatar, View, Text, Button, Image, TouchableOpacity } from 'react-native-ui-lib';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as WebBrowser from 'expo-web-browser';
import RenderHtml, { HTMLElementModel, HTMLContentModel } from 'react-native-render-html';
import { useWindowDimensions } from 'react-native';
import ImageViewing from 'react-native-image-viewing';
import { BlurView } from 'expo-blur';
import { Status, CustomEmoji, Attachment } from '../../services/mastodon/types';
import { useSettings } from '../../services/settingsContext';
import { useTheme } from '../../services/themeContext';
import { useCompose } from '../../services/composeContext';
import { styles } from './styles';
import { favouriteStatus, unfavouriteStatus, reblogStatus, unreblogStatus } from '../../services/mastodon/statuses';
import { Poll } from '../Poll/poll';
import { renderTextWithEmojis } from '../../services/emojiHelper';

const customHTMLElementModels = {
    emoji: HTMLElementModel.fromCustomModel({
        tagName: 'emoji',
        mixedUAStyles: {
            width: 16,
            height: 16,
        },
        contentModel: HTMLContentModel.textual
    })
};

const renderers = {
    emoji: ({ tnode }: any) => {
        return (
            <RNImage
                source={{ uri: tnode.attributes.src }}
                style={{ width: 16, height: 16, resizeMode: 'contain', marginHorizontal: 2 }}
            />
        );
    }
};

const StatusHtmlContent = React.memo(({ content, emojis, colors, compactMode, width, onPressMention, onPressHashtag, onPressLink }: any) => {
    const renderersProps = React.useMemo(() => ({
        a: {
            onPress: (event: any, href: string, htmlAttribs: any) => {
                const className = htmlAttribs.class || '';
                if (className.includes('mention')) {
                    const acct = href.split('/').pop()?.replace(/^@/, '');
                    if (onPressMention && acct) onPressMention(acct);
                    else onPressLink(href);
                } else if (className.includes('hashtag')) {
                    const tag = href.split('/').pop()?.replace(/^#/, '');
                    if (onPressHashtag && tag) onPressHashtag(tag);
                    else onPressLink(href);
                } else {
                    onPressLink(href);
                }
            }
        }
    }), [onPressMention, onPressHashtag, onPressLink]);

    const tagsStyles = React.useMemo(() => ({
        body: {
            color: colors.textPrimary,
            fontSize: compactMode ? 13 : 15,
            lineHeight: compactMode ? 18 : 22,
        },
        a: {
            color: colors.accentColor,
            textDecorationLine: 'none' as const,
        },
        p: {
            marginTop: 0,
            marginBottom: 10,
        }
    }), [colors, compactMode]);

    const processedHtml = React.useMemo(() => {
        let html = content || '';
        html = html.replace(/<span class="invisible">https?:\/\/<\/span>/gi, '');
        html = html.replace(/<span class="invisible">.*?<\/span>/gi, (match: string) => {
            const inner = match.replace(/<[^>]*>/g, '');
            if (inner === '' || inner === '/') return inner;
            return '...';
        });
        if (emojis && emojis.length > 0) {
            emojis.forEach((emoji: CustomEmoji) => {
                const regex = new RegExp(`:${emoji.shortcode}:`, 'g');
                html = html.replace(regex, `<emoji src="${emoji.url}" />`);
            });
        }
        return html;
    }, [content, emojis]);

    return (
        <RenderHtml
            contentWidth={width}
            source={{ html: processedHtml }}
            tagsStyles={tagsStyles}
            renderersProps={renderersProps}
            customHTMLElementModels={customHTMLElementModels}
            renderers={renderers}
        />
    );
});

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





interface TootCardProps {
    status: Status;
    onPressMention?: (acct: string) => void;
    onPressHashtag?: (hashtag: string) => void;
    onPress?: () => void;
    threadMode?: boolean;
    hasThreadLineTop?: boolean;
    hasThreadLineBottom?: boolean;
}

export const TootCard: React.FC<TootCardProps> = ({ status, onPressMention, onPressHashtag, onPress, threadMode, hasThreadLineTop, hasThreadLineBottom }) => {
    const { compactMode } = useSettings();
    const { colors } = useTheme();
    const { openCompose } = useCompose();
    const { width, height } = useWindowDimensions();
    const isReblog = !!status.reblog;
    const targetStatus = isReblog ? status.reblog! : status;

    const [isSpoilerCollapsed, setIsSpoilerCollapsed] = useState(targetStatus.sensitive);
    const [isFavorited, setIsFavorited] = useState(targetStatus.favourited);
    const [isReblogged, setIsreblogged] = useState(targetStatus.reblogged);
    const [favCount, setFavCount] = useState(targetStatus.favourites_count);
    const [boostCount, setBoostCount] = useState(targetStatus.reblogs_count);
    const [isImageViewerVisible, setIsImageViewerVisible] = useState(false);
    const [imageViewerIndex, setImageViewerIndex] = useState(0);
    const [isMediaRevealed, setIsMediaRevealed] = useState(false);
    const [isVideoVisible, setIsVideoVisible] = useState(false);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);

    const player = useVideoPlayer(videoUrl, player => {
        if (targetStatus.media_attachments?.find(a => a.url === videoUrl)?.type === 'gifv') {
            player.loop = true;
        }
        player.play();
    });

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
        let mediaContent;

        if (count === 1) {
            mediaContent = (
                <TouchableOpacity 
                    style={[styles.mediaContainer, targetStatus.sensitive && !isMediaRevealed && { marginBottom: 0 }]}
                    onPress={() => {
                        if (attachments[0].type === 'video' || attachments[0].type === 'gifv') {
                            setVideoUrl(attachments[0].url);
                            setIsVideoVisible(true);
                        } else {
                            setImageViewerIndex(0);
                            setIsImageViewerVisible(true);
                        }
                    }}
                >
                    <Image
                        source={{ uri: attachments[0].preview_url || attachments[0].url }}
                        style={styles.singleMedia}
                    />
                </TouchableOpacity>
            );
        } else {
            mediaContent = (
                <View style={[styles.mediaGrid, targetStatus.sensitive && !isMediaRevealed && { marginBottom: 0 }]}>
                    {attachments.map((item, idx) => (
                        <TouchableOpacity
                            key={item.id || idx}
                            style={[
                                styles.gridMedia,
                                { width: count === 2 ? '48%' : '31%' }
                            ]}
                            onPress={() => {
                                if (item.type === 'video' || item.type === 'gifv') {
                                    setVideoUrl(item.url);
                                    setIsVideoVisible(true);
                                } else {
                                    setImageViewerIndex(idx);
                                    setIsImageViewerVisible(true);
                                }
                            }}
                        >
                            <Image
                                source={{ uri: item.preview_url || item.url }}
                                style={{ width: '100%', height: '100%', borderRadius: 8 }}
                            />
                        </TouchableOpacity>
                    ))}
                </View>
            );
        }

        if (targetStatus.sensitive && !isMediaRevealed) {
            return (
                <View style={styles.blurContainer}>
                    {mediaContent}
                    <BlurView intensity={80} style={StyleSheet.absoluteFill}>
                        <TouchableOpacity onPress={() => setIsMediaRevealed(true)} style={styles.revealButton}>
                            <Ionicons name="eye-off" size={24} color="#FFF" />
                            <Text style={styles.revealText}>Sensitive Content (Tap to show)</Text>
                        </TouchableOpacity>
                    </BlurView>
                </View>
            );
        }

        return mediaContent;
    };

    const imageViewerImages = targetStatus.media_attachments?.map(attachment => ({
        uri: attachment.url
    })) || [];

    const ImageViewerFooter = ({ imageIndex }: { imageIndex: number }) => {
        if (imageViewerImages.length <= 1) return null;
        return (
            <View style={{ height, width: '100%', position: 'absolute', bottom: 0 }} pointerEvents="box-none">
                {imageIndex > 0 && (
                    <View style={[styles.imageViewerNavButton, styles.imageViewerNavLeft]}>
                        <Ionicons name="chevron-back" size={24} color="#FFF" />
                    </View>
                )}
                {imageIndex < imageViewerImages.length - 1 && (
                    <View style={[styles.imageViewerNavButton, styles.imageViewerNavRight]}>
                        <Ionicons name="chevron-forward" size={24} color="#FFF" />
                    </View>
                )}
            </View>
        );
    };

    const avatarSize = compactMode ? 32 : 44;
    const cardPadding = compactMode ? 10 : 16;
    // contentWidth is screen width - card padding on both sides - avatar size - gap (10)
    const contentWidth = width - (cardPadding * 2) - avatarSize - 10;

    const CardContainer = onPress ? TouchableOpacity : View;

    return (
        <CardContainer 
            onPress={onPress}
            style={[
            styles.cardContainer,
            { backgroundColor: colors.cardBackground, borderColor: colors.borderColor },
            compactMode && { padding: 10, marginVertical: 4, marginHorizontal: 12, borderRadius: 10 },
            threadMode && {
                backgroundColor: 'transparent',
                borderWidth: 0,
                marginHorizontal: 0,
                marginVertical: 0,
                shadowOpacity: 0,
                elevation: 0,
            }
        ]}>
            {/* boost header */}
            {isReblog && (
                <View style={styles.boostedHeader}>
                    <Ionicons name="repeat" size={14} color={colors.textMuted} />
                    <Avatar source={{ uri: status.account.avatar }} size={18} containerStyle={styles.boostedAvatar} />
                    {renderTextWithEmojis(
                        (status.account.display_name || status.account.username) + ' boosted',
                        status.account.emojis || [],
                        [styles.boostedText, { color: colors.textMuted }],
                        14
                    )}
                </View>
            )}

            <View style={styles.mainRow}>
                <View style={[styles.leftColumn, { width: avatarSize }]}>
                    {threadMode && hasThreadLineTop && (
                        <View style={{
                            position: 'absolute',
                            width: 2,
                            backgroundColor: colors.borderColor,
                            top: -cardPadding,
                            height: cardPadding + avatarSize / 2,
                            zIndex: -1
                        }} />
                    )}
                    {threadMode && hasThreadLineBottom && (
                        <View style={{
                            position: 'absolute',
                            width: 2,
                            backgroundColor: colors.borderColor,
                            top: avatarSize / 2,
                            bottom: -cardPadding,
                            zIndex: -1
                        }} />
                    )}
                    <Avatar source={{ uri: targetStatus.account.avatar }} size={avatarSize} />
                </View>

                <View style={styles.rightColumn}>
                    {/* author */}
                    <View style={styles.headerRow}>
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
                            <StatusHtmlContent
                                content={targetStatus.content}
                                emojis={targetStatus.emojis}
                                colors={colors}
                                compactMode={compactMode}
                                width={contentWidth + (compactMode ? 44 : 64)} // pass equivalent width to keep old behavior inside StatusHtmlContent or just modify StatusHtmlContent
                                onPressMention={onPressMention}
                                onPressHashtag={onPressHashtag}
                                onPressLink={handlePressCard}
                            />
                        </View>
                    )}

                    {/* poll */}
                    {(!targetStatus.sensitive || !isSpoilerCollapsed) && targetStatus.poll && (
                        <Poll initialPoll={targetStatus.poll} />
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
                            <Ionicons name="repeat" size={18} color={isReblogged ? colors.accentColor : colors.textMuted} />
                            <Text style={[styles.actionCount, { color: isReblogged ? colors.accentColor : colors.textMuted }]}>
                                {boostCount || 0}
                            </Text>
                        </TouchableOpacity>
                        {/* favourite */}
                        <TouchableOpacity style={styles.actionButton} onPress={toggleFavorite}>
                            <Ionicons name={isFavorited ? "star" : "star-outline"} size={18} color={isFavorited ? colors.dangerColor : colors.textMuted} />
                            <Text style={[styles.actionCount, { color: isFavorited ? colors.dangerColor : colors.textMuted }]}>{favCount || 0}</Text>
                        </TouchableOpacity>
                        {/* share */}
                        <TouchableOpacity style={styles.actionButton}>
                            <Ionicons name="share-social-outline" size={18} color={colors.textMuted} />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            <ImageViewing
                images={imageViewerImages}
                imageIndex={imageViewerIndex}
                visible={isImageViewerVisible}
                onRequestClose={() => setIsImageViewerVisible(false)}
                swipeToCloseEnabled={true}
                doubleTapToZoomEnabled={true}
                backgroundColor="rgba(0, 0, 0, 0.85)"
                FooterComponent={ImageViewerFooter}
            />

            <Modal visible={isVideoVisible} onRequestClose={() => { player.pause(); setIsVideoVisible(false); }} animationType="fade">
                <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center' }}>
                    {videoUrl && (
                        <VideoView
                            player={player}
                            style={{ width: '100%', height: '80%' }}
                            allowsFullscreen
                            allowsPictureInPicture
                            contentFit="contain"
                        />
                    )}
                    <TouchableOpacity onPress={() => { player.pause(); setIsVideoVisible(false); }} style={styles.closeButton}>
                        <Ionicons name="close" size={30} color="#FFF" />
                    </TouchableOpacity>
                </View>
            </Modal>
        </CardContainer>
    );
};
