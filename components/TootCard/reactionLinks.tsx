import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Avatar } from '../ui';
import { getReactions, Reaction } from '../../services/mastodon/statuses';
import { Status } from '../../services/mastodon/types';
import { useTheme } from '../../services/themeContext';
import { useI18n } from '../../services/i18n/i18nContext';
import { useSettings } from '../../services/settingsContext';
import { useNavigator } from '../../services/navigationContext';
import { radii, space } from '../../services/theme/shape';

export const REACTION_AVATARS = 3;

interface ReactionLinkProps {
    label: string;
    onPress: () => void;
    // With these, the first few people who favourited or boosted show as small overlapping avatars
    statusId?: string;
    reaction?: Reaction;
}

// One of the links under a post ("12 favourites"), opening who did it
export const ReactionLink: React.FC<ReactionLinkProps> = ({ label, onPress, statusId, reaction }) => {
    const { colors, type } = useTheme();
    const { data } = useQuery({
        queryKey: ['reactionAvatars', statusId, reaction],
        queryFn: () => getReactions(statusId!, reaction!, undefined, REACTION_AVATARS),
        enabled: !!statusId && !!reaction,
    });
    const people = data?.accounts.slice(0, REACTION_AVATARS) ?? [];

    return (
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.link}>
            {people.length > 0 && (
                <View style={styles.avatars} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                    {people.map((account, index) => (
                        <View
                            key={account.id}
                            style={[styles.avatar, { borderColor: colors.cardBackground }, index > 0 && styles.avatarStacked]}
                        >
                            <Avatar name={account.display_name || account.username} uri={account.avatar} size={20} />
                        </View>
                    ))}
                </View>
            )}
            <Text style={[type.meta, { color: colors.accentText }]}>{label}</Text>
        </Pressable>
    );
};

// Who favourited, boosted and quoted a post (without the numbers when they're hidden); only the
// links with someone behind them show
export const ReactionLinks: React.FC<{ status: Status }> = ({ status }) => {
    const { t, tn } = useI18n();
    const { hideCounts } = useSettings();
    const { push } = useNavigator();
    const links = [
        { reaction: 'favourites' as const, count: status.favourites_count, plain: 'reactions.favourites' as const, counted: 'reactions.favouritesCount' as const, open: () => push({ name: 'reactions', statusId: status.id, reaction: 'favourites' }) },
        { reaction: 'boosts' as const, count: status.reblogs_count, plain: 'reactions.boosts' as const, counted: 'reactions.boostsCount' as const, open: () => push({ name: 'reactions', statusId: status.id, reaction: 'boosts' }) },
        { reaction: undefined, count: status.quotes_count ?? 0, plain: 'reactions.quotes' as const, counted: 'quotes.count' as const, open: () => push({ name: 'quotes', status }) },
    ].filter(link => link.count > 0);
    if (links.length === 0) return null;

    return (
        <View style={styles.links}>
            {links.map(link => (
                <ReactionLink
                    key={link.plain}
                    label={hideCounts ? t(link.plain) : tn(link.counted, link.count)}
                    onPress={link.open}
                    statusId={link.reaction && status.id}
                    reaction={link.reaction}
                />
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    links: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        columnGap: space.lg,
        marginTop: space.xs,
    },
    link: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        minHeight: 32,
    },
    avatars: {
        flexDirection: 'row',
    },
    avatar: {
        borderRadius: radii.pill,
        borderWidth: 1.5,
    },
    avatarStacked: {
        marginLeft: -7,
    },
});
