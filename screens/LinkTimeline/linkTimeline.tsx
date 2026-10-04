import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../services/themeContext';
import { useThemedStyles } from '../../services/theme/useThemedStyles';
import { useI18n } from '../../services/i18n/i18nContext';
import { useLinkTimeline } from '../../hooks/useExplore';
import { Status } from '../../services/mastodon/types';
import { TootCard } from '../../components/TootCard/tootCard';
import { IconButton, PillButton } from '../../components/ui';
import { openLink } from '../../components/TootCard/htmlContent';
import { makeStyles } from './styles';

interface LinkTimelineProps {
    url: string;
    title?: string;
    onBack: () => void;
    onStatusPress: (id: string) => void;
}

const getDomain = (urlStr: string, fallback: string) => {
    try {
        const matches = urlStr.match(/^https?:\/\/([^/?#]+)(?:[/?#]|$)/i);
        return matches && matches[1] ? matches[1].replace(/^www\./, '') : fallback;
    } catch {
        return fallback;
    }
};

const LinkTimeline = ({ url, title, onBack, onStatusPress }: LinkTimelineProps) => {
    const { colors, type } = useTheme();
    const { t } = useI18n();
    const styles = useThemedStyles(makeStyles);
    const insets = useSafeAreaInsets();
    const [isPullRefreshing, setIsPullRefreshing] = useState(false);

    const domain = getDomain(url, t('common.link'));
    const displayTitle = title || domain;

    const { data, isLoading, isError, isFetchingNextPage, hasNextPage, fetchNextPage, refetch } =
        useLinkTimeline(url);
    const statuses = data?.pages.flat() ?? [];

    const handleRefresh = useCallback(async () => {
        setIsPullRefreshing(true);
        try {
            await refetch();
        } finally {
            setIsPullRefreshing(false);
        }
    }, [refetch]);

    const handleOpenArticle = () => openLink(url);

    const intro = (
        <View style={styles.intro}>
            <View style={styles.domainBadge}>
                <Ionicons name="link-outline" size={14} color={colors.accentText} />
                <Text style={[type.label, styles.domainText]}>{domain}</Text>
            </View>
            <Text accessibilityRole="header" style={[type.title, styles.title]}>
                {displayTitle}
            </Text>
            <Text style={[type.body, styles.hint]}>
                {t('linkTimeline.postsAbout')}
            </Text>
            <PillButton
                label={t('news.read')}
                variant="secondary"
                size="small"
                icon="open-outline"
                onPress={handleOpenArticle}
            />
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <IconButton icon="arrow-back" accessibilityLabel={t('common.goBack')} onPress={onBack} />
                <Text style={[type.name, styles.headerTitle]} numberOfLines={1}>
                    {displayTitle}
                </Text>
                <View style={styles.headerSpacer} />
            </View>

            <FlashList
                data={statuses}
                keyExtractor={(item: Status) => item.id}
                renderItem={({ item }) => <TootCard status={item} onPress={onStatusPress} />}
                ListHeaderComponent={intro}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        {isLoading ? (
                            <ActivityIndicator color={colors.accentColor} />
                        ) : isError ? (
                            <>
                                <Text style={[type.body, styles.emptyText]}>
                                    {t('linkTimeline.unsupported')}
                                </Text>
                                <PillButton
                                    label={t('news.read')}
                                    icon="open-outline"
                                    onPress={handleOpenArticle}
                                />
                            </>
                        ) : (
                            <>
                                <Text style={[type.body, styles.emptyText]}>
                                    {t('linkTimeline.empty')}
                                </Text>
                                <PillButton
                                    label={t('news.read')}
                                    variant="secondary"
                                    icon="open-outline"
                                    onPress={handleOpenArticle}
                                />
                            </>
                        )}
                    </View>
                }
                ListFooterComponent={
                    isFetchingNextPage ? (
                        <ActivityIndicator style={styles.footer} color={colors.accentColor} />
                    ) : null
                }
                onEndReached={() => {
                    if (!isFetchingNextPage && hasNextPage) fetchNextPage();
                }}
                onEndReachedThreshold={0.5}
                refreshControl={
                    <RefreshControl
                        refreshing={isPullRefreshing}
                        onRefresh={handleRefresh}
                        tintColor={colors.accentColor}
                        colors={[colors.accentColor]}
                    />
                }
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
};

export default LinkTimeline;
