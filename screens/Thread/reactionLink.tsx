import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Avatar } from '../../components/ui';
import { getReactions, Reaction } from '../../services/mastodon/statuses';
import { useTheme } from '../../services/themeContext';
import { radii, space } from '../../services/theme/shape';

export const REACTION_AVATARS = 3;

interface ReactionLinkProps {
    label: string;
    onPress: () => void;
    // With these, the first few people who favourited or boosted show as small overlapping avatars
    statusId?: string;
    reaction?: Reaction;
}

// One of the links under a thread's post ("12 favourites"), opening who did it
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

const styles = StyleSheet.create({
    link: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        paddingBottom: space.md,
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
