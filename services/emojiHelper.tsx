import React from 'react';
import { Image as RNImage, Text } from 'react-native';
import { CustomEmoji } from './mastodon/types';

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
