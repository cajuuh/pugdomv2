import React, { useState } from 'react';
import { LayoutChangeEvent, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Icon } from '../ui/icon';
import { useVideoPlayer, VideoView } from 'expo-video';
import { mediaColors } from '../../services/theme/media';
import { radii, space } from '../../services/theme/shape';
import { Attachment } from '../../services/mastodon/types';
import { useI18n } from '../../services/i18n/i18nContext';
import { focusedCover, fromMastodonFocus, Size } from '../../services/media/geometry';

interface FocusedImageProps {
    attachment: Attachment;
    style?: StyleProp<ViewStyle>;
    // Sensitive media while hidden: blurred past recognition, so the real picture never shows
    blurred?: boolean;
    // The whole picture, letterboxed, instead of filling the tile
    contain?: boolean;
    // Autoplay: a video or GIF plays here, muted and looping, over its frame
    playing?: boolean;
}

const HIDDEN_BLUR_RADIUS = 60;
// Tiles narrower than this (quoted posts' thumbnails) get a smaller play button and no length
const SMALL_TILE = 120;

// "0:42", "12:05"
export const formatDuration = (seconds: number) => {
    const whole = Math.round(seconds);
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

// Mounted only while it plays, so a list holds one player at a time and releases it off screen
const InlineVideo: React.FC<{ url: string; contain?: boolean }> = ({ url, contain }) => {
    const player = useVideoPlayer(url, player => {
        player.muted = true;
        player.loop = true;
        player.play();
    });
    return (
        <>
            <VideoView
                testID="inline-video"
                player={player}
                style={StyleSheet.absoluteFill}
                contentFit={contain ? 'contain' : 'cover'}
                nativeControls={false}
                // A SurfaceView ignores the tile's clipping and lags behind the list while scrolling
                surfaceType="textureView"
            />
            {/* On Android the video view takes every touch for itself, so a plain view on top gets the tap for the tile */}
            <View testID="video-touch-cover" style={StyleSheet.absoluteFill} />
        </>
    );
};

// A post image that fills its tile. With a focal point (set by the author, on any server) the crop
// keeps that point in view instead of the middle; without one it's a plain centered cover.
export const FocusedImage: React.FC<FocusedImageProps> = ({ attachment, style, blurred, contain, playing }) => {
    // The tile's size: layout, not per-post state, so it doesn't need resetting when the card is reused
    const [box, setBox] = useState<Size | null>(null);
    const uri = attachment.preview_url || attachment.url;
    // Mastodon's blurred sketch of the picture, shown until it loads
    const placeholder = attachment.blurhash ? { blurhash: attachment.blurhash } : undefined;
    const focus = attachment.meta?.focus;
    const size = attachment.meta?.original ?? attachment.meta?.small;
    const focused = !!focus && (focus.x !== 0 || focus.y !== 0) && !!size?.width && !!size?.height;
    const duration = attachment.meta?.original?.duration;
    const small = !!box && box.width < SMALL_TILE;
    const { t } = useI18n();
    const measure = (event: LayoutChangeEvent) => {
        const { width, height } = event.nativeEvent.layout;
        setBox(current => (current?.width === width && current?.height === height ? current : { width, height }));
    };

    // Media the server didn't keep (it rejects that server's media, or the file is gone): nothing to draw
    if (attachment.type === 'unknown') {
        return (
            <View style={[style, styles.clip, styles.center, styles.unavailable]} testID="media-unavailable" onLayout={measure}>
                <Icon name="alert-circle-outline" size={small ? 18 : 24} color={mediaColors.ink} />
                {!small && <Text style={styles.unavailableText}>{t('post.mediaUnavailable')}</Text>}
            </View>
        );
    }

    // A podcast, song or voice note: its cover art when it has one, and a play button that says it's audio.
    // Tapping the tile plays it in the media viewer; it never autoplays.
    if (attachment.type === 'audio') {
        return (
            <View style={[style, styles.clip, styles.audio, styles.unavailable]} testID="audio-tile" onLayout={measure}>
                {attachment.preview_url ? (
                    <Image
                        source={{ uri: attachment.preview_url }}
                        placeholder={placeholder}
                        recyclingKey={attachment.preview_url}
                        style={StyleSheet.absoluteFill}
                        contentFit={contain ? 'contain' : 'cover'}
                        blurRadius={blurred ? HIDDEN_BLUR_RADIUS : undefined}
                    />
                ) : (
                    !small && <Icon name="volume-high-outline" size={40} color={mediaColors.ink} />
                )}
                {/* Hidden while veiled, like the video badge, so it doesn't show through the sensitive label */}
                {!blurred && (
                    <View testID="audio-badge" style={[styles.audioPill, small && styles.audioPillSmall]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                        <Icon name="play" size={small ? 14 : 18} color={mediaColors.ink} />
                        {!small && (
                            <Text style={styles.cornerText}>
                                {t('post.audio')}
                                {duration ? ` · ${formatDuration(duration)}` : ''}
                            </Text>
                        )}
                    </View>
                )}
            </View>
        );
    }

    return (
        <View
            style={[style, styles.clip]}
            testID="focused-image"
            onLayout={measure}
        >
            {!focused || blurred || contain ? (
                <Image
                    source={{ uri }}
                    placeholder={placeholder}
                    recyclingKey={uri}
                    testID={blurred ? 'focused-image-blurred' : contain ? 'focused-image-whole' : undefined}
                    style={StyleSheet.absoluteFill}
                    contentFit={contain ? 'contain' : 'cover'}
                    blurRadius={blurred ? HIDDEN_BLUR_RADIUS : undefined}
                />
            ) : (
                box && (
                    <Image
                        source={{ uri }}
                        placeholder={placeholder}
                        recyclingKey={uri}
                        testID="focused-image-picture"
                        style={[styles.positioned, focusedCover(box, { width: size!.width!, height: size!.height! }, fromMastodonFocus(focus!))]}
                    />
                )
            )}
            {playing && <InlineVideo url={attachment.url} contain={contain} />}
            {/* A video or GIF shows one frame here; say what it really is (screen readers already hear "Video" / "GIF") */}
            {!blurred && !playing && attachment.type === 'video' && (
                <View pointerEvents="none" style={styles.center} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                    <View testID="video-badge" style={[styles.play, small && styles.playSmall]}>
                        <Icon name="play" size={small ? 14 : 24} color={mediaColors.ink} style={styles.playIcon} />
                    </View>
                </View>
            )}
            {!blurred && !small && (attachment.type === 'gifv' || (attachment.type === 'video' && !!duration)) && (
                <View pointerEvents="none" style={styles.corner} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                    <Text testID="media-kind-label" style={styles.cornerText}>
                        {attachment.type === 'gifv' ? 'GIF' : formatDuration(duration!)}
                    </Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    clip: {
        overflow: 'hidden',
    },
    center: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    play: {
        width: 52,
        height: 52,
        borderRadius: radii.pill,
        backgroundColor: mediaColors.scrim,
        alignItems: 'center',
        justifyContent: 'center',
    },
    playSmall: {
        width: 28,
        height: 28,
    },
    // The triangle looks centered a little to the right of the circle's middle
    playIcon: {
        marginLeft: 3,
    },
    // Bottom right: ALT sits bottom left, Hide top left, the media grid's badges top right
    corner: {
        position: 'absolute',
        right: space.sm,
        bottom: space.sm,
        borderRadius: radii.pill,
        paddingHorizontal: space.sm,
        paddingVertical: 2,
        backgroundColor: mediaColors.scrim,
    },
    cornerText: {
        color: mediaColors.ink,
        fontSize: 12,
        fontWeight: '700',
    },
    audioPill: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.xs,
        minHeight: 36,
        paddingHorizontal: space.md,
        borderRadius: radii.pill,
        backgroundColor: mediaColors.scrimStrong,
    },
    audio: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    audioPillSmall: {
        minHeight: 28,
        width: 28,
        paddingHorizontal: 0,
    },
    positioned: {
        position: 'absolute',
    },
    unavailable: {
        gap: space.xs,
        padding: space.sm,
        backgroundColor: mediaColors.scrim,
    },
    unavailableText: {
        color: mediaColors.ink,
        fontSize: 13,
        fontWeight: '600',
        textAlign: 'center',
    },
});
