import React from 'react';
import { Image as RNImage, ImageStyle, Text } from 'react-native';
import { CustomEmoji } from './mastodon/types';

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
                            <RNImage
                                key={index}
                                source={{ uri: emoji.url }}
                                style={inlineEmojiStyle(emojiSize)}
                            />
                        );
                    }
                }
                return <React.Fragment key={index}>{part}</React.Fragment>;
            })}
        </Text>
    );
};
