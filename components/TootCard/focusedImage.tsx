import React, { useState } from 'react';
import { Image, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { mediaColors } from '../../services/theme/media';
import { radii, space } from '../../services/theme/shape';
import { Attachment } from '../../services/mastodon/types';
import { focusedCover, fromMastodonFocus, Size } from '../../services/media/geometry';

interface FocusedImageProps {
    attachment: Attachment;
    style?: StyleProp<ViewStyle>;
    // Sensitive media while hidden: blurred past recognition, so the real picture never shows
    blurred?: boolean;
    // The whole picture, letterboxed, instead of filling the tile
    contain?: boolean;
}

const HIDDEN_BLUR_RADIUS = 60;
// Tiles narrower than this (quoted posts' thumbnails) get a smaller play button and no length
const SMALL_TILE = 120;

// "0:42", "12:05"
export const formatDuration = (seconds: number) => {
    const whole = Math.round(seconds);
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

// A post image that fills its tile. With a focal point (set by the author, on any server) the crop
// keeps that point in view instead of the middle; without one it's a plain centered cover.
export const FocusedImage: React.FC<FocusedImageProps> = ({ attachment, style, blurred, contain }) => {
    // The tile's size: layout, not per-post state, so it doesn't need resetting when the card is reused
    const [box, setBox] = useState<Size | null>(null);
    const uri = attachment.preview_url || attachment.url;
    const focus = attachment.meta?.focus;
    const size = attachment.meta?.original ?? attachment.meta?.small;
    const focused = !!focus && (focus.x !== 0 || focus.y !== 0) && !!size?.width && !!size?.height;
    const duration = attachment.meta?.original?.duration;
    const small = !!box && box.width < SMALL_TILE;

    return (
        <View
            style={[style, styles.clip]}
            testID="focused-image"
            onLayout={event => {
                const { width, height } = event.nativeEvent.layout;
                setBox(current => (current?.width === width && current?.height === height ? current : { width, height }));
            }}
        >
            {!focused || blurred || contain ? (
                <Image
                    source={{ uri }}
                    testID={blurred ? 'focused-image-blurred' : contain ? 'focused-image-whole' : undefined}
                    style={StyleSheet.absoluteFill}
                    resizeMode={contain ? 'contain' : 'cover'}
                    blurRadius={blurred ? HIDDEN_BLUR_RADIUS : undefined}
                />
            ) : (
                box && (
                    <Image
                        source={{ uri }}
                        testID="focused-image-picture"
                        style={[styles.positioned, focusedCover(box, { width: size!.width!, height: size!.height! }, fromMastodonFocus(focus!))]}
                    />
                )
            )}
            {/* A video or GIF shows one frame here; say what it really is (screen readers already hear "Video" / "GIF") */}
            {!blurred && attachment.type === 'video' && (
                <View pointerEvents="none" style={styles.center} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                    <View testID="video-badge" style={[styles.play, small && styles.playSmall]}>
                        <Ionicons name="play" size={small ? 14 : 24} color={mediaColors.ink} style={styles.playIcon} />
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
    positioned: {
        position: 'absolute',
    },
});
