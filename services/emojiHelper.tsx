import React from 'react';
import { Image as RNImage, ImageStyle, StyleSheet, Text, View } from 'react-native';
import { CustomEmoji } from './mastodon/types';
import { useOptionalSettings } from './settingsContext';

// Animated custom emoji keep the screen redrawing (battery): the still file unless media autoplay is on
export const emojiSource = (emoji: Pick<CustomEmoji, 'url' | 'static_url'>, animate: boolean) =>
    (animate ? emoji.url : emoji.static_url) || emoji.url || emoji.static_url;

const EmojiImage = ({ emoji, style }: { emoji: CustomEmoji; style: ImageStyle }) => {
    const animate = useOptionalSettings()?.mediaAutoplay ?? false;
    return <RNImage source={{ uri: emojiSource(emoji, animate) }} style={style} />;
};

// Share of its height an emoji is lowered by, to tune how it sits against the text
const EMOJI_DROP = 0.2;

// Android and iOS rest a view inside text on the baseline, so an emoji about as tall as the font
// floats above the letters (measured on Android: its centre 2-4 pt above theirs)
export const inlineEmojiStyle = (size: number): ImageStyle => ({
    width: size,
    height: size,
    resizeMode: 'contain',
    transform: [{ translateY: size * EMOJI_DROP }],
});

export const renderTextWithEmojis = (
    text: string,
    emojis: CustomEmoji[],
    textStyle: any,
    emojiSize: number = 16,
    numberOfLines?: number
) => {
    if (!text) {
        return null;
    } else if (!emojis || emojis.length === 0) {
        return <Text style={textStyle} numberOfLines={numberOfLines}>{text}</Text>;
    }

    const parts = text.split(/(:\w+:)/g);

    return (
        <Text style={textStyle} numberOfLines={numberOfLines}>
            {parts.map((part, index) => {
                if (part.startsWith(':') && part.endsWith(':')) {
                    const shortcode = part.slice(1, -1);
                    const emoji = emojis.find((e) => e.shortcode === shortcode);
                    if (emoji) {
                        return (
                            <EmojiImage key={index} emoji={emoji} style={inlineEmojiStyle(emojiSize)} />
                        );
                    }
                }
                return <React.Fragment key={index}>{part}</React.Fragment>;
            })}
        </Text>
    );
};

// A name on one line, its custom emoji beside the text rather than inside it. Android lays out text a
// hair narrower than it measured it, so an emoji inside text wraps onto a line the row has no room for
// and draws over whatever is below; pieces in a row can't wrap. Long names cut off with "…".
// iOS draws an emoji inside large text below the line and clips it, so big names (the profile) use this too.
export const renderNameWithEmojis = (text: string, emojis: CustomEmoji[], textStyle: any, emojiSize: number = 16, lines = 1) => {
    if (!text) return null;
    const parts = text.split(/(:\w+:)/g).map(part => part.trim()).filter(Boolean);
    return (
        <View style={styles.nameRow}>
            {parts.map((part, index) => {
                const emoji = /^:\w+:$/.test(part) ? emojis?.find(e => e.shortcode === part.slice(1, -1)) : undefined;
                return emoji ? (
                    <EmojiImage key={index} emoji={emoji} style={{ width: emojiSize, height: emojiSize, resizeMode: 'contain' }} />
                ) : (
                    <Text key={index} style={[textStyle, styles.namePart]} numberOfLines={lines}>{part}</Text>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        maxWidth: '100%',
    },
    namePart: {
        flexShrink: 1,
    },
});
