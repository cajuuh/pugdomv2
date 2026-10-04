import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, PillButton } from '../ui';
import { TrendLink, weeklyTrendUsage } from '../../services/mastodon/trends';
import { useTheme } from '../../services/themeContext';
import { useThemedStyles } from '../../services/theme/useThemedStyles';
import { useI18n } from '../../services/i18n/i18nContext';
import { openLink } from '../TootCard/htmlContent';
import { makeStyles } from './styles';

const getDomain = (urlStr: string, fallback: string) => {
    try {
        const matches = urlStr.match(/^https?:\/\/([^/?#]+)(?:[/?#]|$)/i);
        return matches && matches[1] ? matches[1].replace(/^www\./, '') : fallback;
    } catch {
        return fallback;
    }
};

export interface NewsCardProps {
    link: TrendLink;
    onPressLinkTimeline?: (url: string, title?: string) => void;
}

export const NewsCard: React.FC<NewsCardProps> = ({ link, onPressLinkTimeline }) => {
    const { colors, type } = useTheme();
    const { t, tn } = useI18n();
    const styles = useThemedStyles(makeStyles);

    const domain = getDomain(link.url, t('common.link'));
    const provider = link.provider_name || domain;
    const usage = weeklyTrendUsage(link.history);

    const handleRead = () => openLink(link.url);
    const handleTimeline = () => {
        if (onPressLinkTimeline) {
            onPressLinkTimeline(link.url, link.title);
        } else {
            handleRead();
        }
    };

    return (
        <Card style={styles.card}>
            <Pressable onPress={handleTimeline} accessibilityRole="link" accessibilityLabel={link.title || domain}>
                <View style={styles.header}>
                    <View style={styles.providerBadge}>
                        <Ionicons name="newspaper-outline" size={13} color={colors.accentText} />
                        <Text style={[type.label, styles.providerText]} numberOfLines={1}>
                            {provider}
                        </Text>
                    </View>
                    {usage.people > 0 && (
                        <Text style={[type.meta, styles.usageText]}>
                            {t('news.discussedBy', { people: tn('news.people', usage.people) })}
                        </Text>
                    )}
                </View>

                {link.image ? (
                    <View style={styles.imageContainer}>
                        <Image source={{ uri: link.image }} style={styles.image} resizeMode="cover" />
                    </View>
                ) : null}

                <Text style={[type.name, styles.title]} numberOfLines={2}>
                    {link.title || domain}
                </Text>

                {link.description ? (
                    <Text style={[type.body, styles.description]} numberOfLines={3}>
                        {link.description}
                    </Text>
                ) : null}
            </Pressable>

            <View style={styles.actions}>
                <PillButton
                    label={t('news.read')}
                    variant="secondary"
                    size="small"
                    icon="open-outline"
                    onPress={handleRead}
                />
                {onPressLinkTimeline && (
                    <PillButton
                        label={t('news.posts')}
                        size="small"
                        icon="chatbubbles-outline"
                        onPress={handleTimeline}
                    />
                )}
            </View>
        </Card>
    );
};
