import React from 'react';
import { Image } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import RenderHtml, { HTMLElementModel, HTMLContentModel, defaultSystemFonts } from 'react-native-render-html';
import { CustomEmoji } from '../../services/mastodon/types';
import { fontFamilies } from '../../services/theme/typography';
import { tagFromHref } from '../../services/mastodon/tags';
import { withoutQuoteInline } from '../../services/htmlText';

// Post (and bio) HTML: custom emoji inline, mentions / hashtags / links routed to the handlers

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
            <Image
                source={{ uri: tnode.attributes.src }}
                style={{ width: 16, height: 16, resizeMode: 'contain', marginHorizontal: 2 }}
            />
        );
    }
};

// RenderHtml ignores font families it wasn't told about
const systemFonts = [...defaultSystemFonts, ...Object.values(fontFamilies)];

// What a link in a post is. Mastodon marks hashtags as class="mention hashtag" (rel="tag"), so check for
// hashtags before mentions; links from other software may only have the /tags/ path.
export const linkKind = (href: string, attribs: { class?: string; rel?: string } = {}): 'hashtag' | 'mention' | 'link' => {
    const classes = (attribs.class || '').split(/\s+/);
    if (classes.includes('hashtag') || (attribs.rel || '').split(/\s+/).includes('tag') || /\/tags\/[^/?#]+\/?(?:[?#]|$)/.test(href)) {
        return 'hashtag';
    }
    if (classes.includes('mention')) return 'mention';
    return 'link';
};

export const StatusHtmlContent = React.memo(({ content, emojis, colors, bodyFont, compactMode, width, onPressMention, onPressHashtag, onPressLink }: any) => {
    const renderersProps = React.useMemo(() => ({
        a: {
            onPress: (event: any, href: string, htmlAttribs: any) => {
                const kind = linkKind(href, htmlAttribs);
                if (kind === 'hashtag') {
                    const tag = tagFromHref(href);
                    if (onPressHashtag && tag) onPressHashtag(tag);
                    else onPressLink(href);
                } else if (kind === 'mention') {
                    // The profile URL; callers match it against the post's mentions to find the account
                    if (onPressMention) onPressMention(href);
                    else onPressLink(href);
                } else {
                    onPressLink(href);
                }
            }
        }
    }), [onPressMention, onPressHashtag, onPressLink]);

    const tagsStyles = React.useMemo(() => ({
        body: {
            ...bodyFont,
            color: colors.textPrimary,
            fontSize: compactMode ? 13 : 15.5,
            lineHeight: compactMode ? 18 : 22.5,
        },
        a: {
            color: colors.accentText,
            textDecorationLine: 'none' as const,
        },
        p: {
            marginTop: 0,
            marginBottom: 10,
        }
    }), [colors, bodyFont, compactMode]);

    const processedHtml = React.useMemo(() => {
        let html = withoutQuoteInline(content || '');
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
            systemFonts={systemFonts}
            renderersProps={renderersProps}
            customHTMLElementModels={customHTMLElementModels}
            renderers={renderers}
        />
    );
});

// Module-level so it's the same function on every render; a new one would defeat StatusHtmlContent's memo
// and make RenderHtml rebuild the post's tree on every card re-render
export const openLink = async (url: string) => {
    try {
        await WebBrowser.openBrowserAsync(url);
    } catch (error) {
        console.error('Failed to open link:', error);
    }
};
