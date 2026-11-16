import React from 'react';
import { Image, Platform, Pressable, Share } from 'react-native';
import RenderHtml, { HTMLElementModel, HTMLContentModel, defaultSystemFonts, useInternalRenderer } from 'react-native-render-html';
import { useOptionalMediaViewer } from '../MediaViewer/mediaViewer';
import { CustomEmoji } from '../../services/mastodon/types';
import { emojiSource, inlineEmojiStyle } from '../../services/emojiHelper';
import { useOptionalSettings } from '../../services/settingsContext';
import { fontFamilies } from '../../services/theme/typography';
import { tagFromHref } from '../../services/mastodon/tags';
import { breakLongRuns, withoutQuoteInline } from '../../services/htmlText';
import { postTextMetrics } from './styles';
import type { useTheme } from '../../services/themeContext';

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

// Tapping an emoji shows it bigger, in the media viewer
const InlineEmoji = ({ src, still, shortcode }: { src: string; still?: string; shortcode: string }) => {
    const viewer = useOptionalMediaViewer();
    const animate = useOptionalSettings()?.mediaAutoplay ?? false;
    const label = `:${shortcode}:`;
    return (
        <Pressable
            testID="inline-emoji"
            disabled={!viewer}
            onPress={() => viewer?.openMedia([{ id: src, type: 'image', url: src, preview_url: src, description: label }], 0)}
            accessibilityRole="imagebutton"
            accessibilityLabel={label}
        >
            <Image source={{ uri: emojiSource({ url: src, static_url: still ?? '' }, animate) }} style={[inlineEmojiStyle(16), { marginHorizontal: 2 }]} />
        </Pressable>
    );
};

// Holding a link offers it to copy or send, instead of opening it on release (tester request). The share
// sheet has Copy on both platforms; iOS builds a link preview from `url`, Android only shares `message`.
export const shareLink = (url: string) => Share.share(Platform.OS === 'ios' ? { url } : { message: url }).catch(() => {});

const LinkRenderer = (props: any) => {
    const { Renderer, rendererProps } = useInternalRenderer('a', props);
    const href = props.tnode.attributes.href;
    if (!href) return <Renderer {...rendererProps} />;
    return <Renderer {...rendererProps} textProps={{ ...rendererProps.textProps, onLongPress: () => shareLink(href) }} />;
};

const renderers = {
    emoji: ({ tnode }: any) => <InlineEmoji src={tnode.attributes.src} still={tnode.attributes.still} shortcode={tnode.attributes.shortcode} />,
    a: LinkRenderer,
};

// Below each paragraph, the last one included
export const PARAGRAPH_GAP = 10;

// Holding the text selects it, to copy (tester request); links and taps on the card still work
const defaultTextProps = { selectable: true };

// Code in posts
const monospace = Platform.select({ ios: 'Menlo', default: 'monospace' });

// RenderHtml ignores font families it wasn't told about
const systemFonts = [...defaultSystemFonts, ...Object.values(fontFamilies), monospace];

// Formatting from servers that post Markdown or HTML (glitch-soc, Akkoma, Pleroma), which Mastodon keeps.
// One family per weight and style: fontWeight and fontStyle can't reach them on custom fonts.
const formattingStyles = (colors: ReturnType<typeof useTheme>['colors'], fontSize: number) => {
    const bold = { fontFamily: fontFamilies.bold };
    const heading = (scale: number) => ({ ...bold, fontSize: Math.round(fontSize * scale), lineHeight: Math.round(fontSize * scale * 1.3), marginTop: 0, marginBottom: PARAGRAPH_GAP / 2 });
    const code = { fontFamily: monospace, fontSize: Math.round(fontSize * 0.9), backgroundColor: colors.inputBackground };
    return {
        strong: bold,
        b: bold,
        em: { fontFamily: fontFamilies.italic, fontStyle: 'normal' as const },
        i: { fontFamily: fontFamilies.italic, fontStyle: 'normal' as const },
        code,
        // Spelled out: the library's own defaults for these didn't reach the device
        pre: { ...code, whiteSpace: 'pre' as const, padding: 10, borderRadius: 8, marginTop: 0, marginBottom: PARAGRAPH_GAP },
        del: { textDecorationLine: 'line-through' as const },
        s: { textDecorationLine: 'line-through' as const },
        blockquote: {
            marginTop: 0,
            marginBottom: PARAGRAPH_GAP,
            marginLeft: 0,
            marginRight: 0,
            paddingLeft: 10,
            borderLeftWidth: 3,
            borderLeftColor: colors.accentColor,
            color: colors.textSecondary,
        },
        ul: { marginTop: 0, marginBottom: PARAGRAPH_GAP, paddingLeft: 18 },
        ol: { marginTop: 0, marginBottom: PARAGRAPH_GAP, paddingLeft: 18 },
        h1: heading(1.3),
        h2: heading(1.2),
        h3: heading(1.1),
        h4: heading(1),
        h5: heading(1),
        h6: heading(1),
    };
};

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

export const StatusHtmlContent = React.memo(({ content, emojis, colors, bodyFont, compactMode, textSize, width, onPressMention, onPressHashtag, onPressLink }: any) => {
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
        ...formattingStyles(colors, postTextMetrics(!!compactMode, textSize).fontSize),
        body: {
            ...bodyFont,
            color: colors.textPrimary,
            ...postTextMetrics(!!compactMode, textSize),
        },
        a: {
            color: colors.linkColor,
            textDecorationLine: 'none' as const,
        },
        p: {
            marginTop: 0,
            marginBottom: PARAGRAPH_GAP,
        }
    }), [colors, bodyFont, compactMode, textSize]);

    const processedHtml = React.useMemo(() => {
        // One <p> for the whole post: each <p> is its own Text, and a selection can't cross Texts, so
        // holding a word could only copy that paragraph
        let html = withoutQuoteInline(content || '').replace(/<\/p>\s*<p[^>]*>/gi, '<br><br>');
        html = html.replace(/<span class="invisible">https?:\/\/<\/span>/gi, '');
        html = html.replace(/<span class="invisible">.*?<\/span>/gi, (match: string) => {
            const inner = match.replace(/<[^>]*>/g, '');
            if (inner === '' || inner === '/') return inner;
            return '...';
        });
        if (emojis && emojis.length > 0) {
            emojis.forEach((emoji: CustomEmoji) => {
                const regex = new RegExp(`:${emoji.shortcode}:`, 'g');
                // Closed explicitly: HTML ignores "/>" on custom tags, so everything after the first
                // emoji (more emoji, the rest of the text) would end up inside it, unseen
                html = html.replace(regex, `<emoji src="${emoji.url}" still="${emoji.static_url}" shortcode="${emoji.shortcode}"></emoji>`);
            });
        }
        return breakLongRuns(html);
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
            defaultTextProps={defaultTextProps}
        />
    );
});

// Module-level so it's the same function on every render; a new one would defeat StatusHtmlContent's memo
// and make RenderHtml rebuild the post's tree on every card re-render
export { openLink } from '../../services/links';
