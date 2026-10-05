import React, { useState } from 'react';
import { Image, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Attachment } from '../../services/mastodon/types';
import { focusedCover, fromMastodonFocus, Size } from '../../services/media/geometry';

interface FocusedImageProps {
    attachment: Attachment;
    style?: StyleProp<ViewStyle>;
}

// A post image that fills its tile. With a focal point (set by the author, on any server) the crop
// keeps that point in view instead of the middle; without one it's a plain centered cover.
export const FocusedImage: React.FC<FocusedImageProps> = ({ attachment, style }) => {
    // The tile's size: layout, not per-post state, so it doesn't need resetting when the card is reused
    const [box, setBox] = useState<Size | null>(null);
    const uri = attachment.preview_url || attachment.url;
    const focus = attachment.meta?.focus;
    const size = attachment.meta?.original ?? attachment.meta?.small;
    const focused = !!focus && (focus.x !== 0 || focus.y !== 0) && !!size?.width && !!size?.height;

    return (
        <View
            style={[style, styles.clip]}
            testID="focused-image"
            onLayout={event => {
                const { width, height } = event.nativeEvent.layout;
                setBox(current => (current?.width === width && current?.height === height ? current : { width, height }));
            }}
        >
            {!focused ? (
                <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
                box && (
                    <Image
                        source={{ uri }}
                        testID="focused-image-picture"
                        style={[styles.positioned, focusedCover(box, { width: size!.width!, height: size!.height! }, fromMastodonFocus(focus!))]}
                    />
                )
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    clip: {
        overflow: 'hidden',
    },
    positioned: {
        position: 'absolute',
    },
});
