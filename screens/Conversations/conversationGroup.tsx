import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../services/themeContext';
import { useI18n } from '../../services/i18n/i18nContext';
import { Conversation, groupConversations, statusPreview } from '../../services/mastodon/conversations';
import { useConversations } from '../../hooks/useConversations';
import { renderTextWithEmojis } from '../../services/emojiHelper';
import { radii, space } from '../../services/theme/shape';
import { TAB_BAR_CLEARANCE } from '../../components/TabBar/styles';
import { getRelativeTime } from '../../components/TootCard/tootCard';
import { Avatar, IconButton } from '../../components/ui';

interface ConversationGroupProps {
    groupKey: string;
    onBack: () => void;
    onStatusPress: (id: string) => void;
}

// Every thread you have with one person (or group of people), newest activity first. Each card is numbered
// in the order the threads started and peeks at its last message as a chat bubble; opening one marks it read.
const ConversationGroupScreen = ({ groupKey, onBack, onStatusPress }: ConversationGroupProps) => {
    const { colors, type } = useTheme();
    const i18n = useI18n();
    const { t, tn } = i18n;
    const insets = useSafeAreaInsets();
    const { conversations, open, me } = useConversations();
    const group = groupConversations(conversations).find(item => item.key === groupKey);
    const people = group?.people ?? [];
    const threads = group?.threads ?? [];
    const names = people.map(account => account.display_name || account.username).join(', ');

    const renderThread = ({ item, index }: { item: Conversation; index: number }) => {
        const last = item.last_status;
        const mine = last?.account.id === me?.id;
        const text = last ? statusPreview(last) : '';
        // Oldest is 1: the number stays put as newer threads arrive on top
        const label = t('conversations.threadNumber', { number: threads.length - index });
        const sender = mine ? t('conversations.yourself') : last?.account.display_name || last?.account.username || '';
        return (
            <Pressable
                onPress={() => open(item, onStatusPress)}
                accessibilityRole="button"
                accessibilityLabel={[label, item.unread ? t('conversations.unread') : null, `${sender}: ${text}`].filter(Boolean).join('. ')}
                style={({ pressed }) => [
                    styles.card,
                    { backgroundColor: colors.cardBackground, borderColor: item.unread ? colors.accentColor : colors.borderColor },
                    pressed && { backgroundColor: colors.inputBackground },
                ]}
            >
                <View style={styles.cardTop}>
                    <View style={[styles.number, { backgroundColor: colors.accentSoft }]}>
                        <Ionicons name="chatbubbles" size={13} color={colors.accentText} />
                        <Text style={[type.label, { color: colors.accentText }]}>{label}</Text>
                    </View>
                    <View style={styles.flex} />
                    {last && <Text style={[type.meta, { color: colors.textMuted }]}>{getRelativeTime(last.created_at, i18n)}</Text>}
                    {item.unread && <View testID="thread-unread" style={[styles.dot, { backgroundColor: colors.accentColor }]} />}
                </View>
                {/* The last message, as a chat would show it: yours on the right in the accent, theirs on the left */}
                <View style={[styles.message, mine && styles.messageMine]}>
                    {!mine && last && <Avatar name={sender} uri={last.account.avatar} size={28} />}
                    <View style={[styles.bubbleColumn, mine && styles.bubbleColumnMine]}>
                        {people.length > 1 && <Text style={[type.meta, { color: colors.textMuted }]}>{sender}</Text>}
                        <View
                            style={[
                                styles.bubble,
                                mine
                                    ? [styles.bubbleMine, { backgroundColor: colors.accentColor }]
                                    : [styles.bubbleTheirs, { backgroundColor: colors.inputBackground }],
                            ]}
                        >
                            <Text style={[type.body, { color: mine ? colors.buttonTextColor : colors.textPrimary }]} numberOfLines={4}>
                                {renderTextWithEmojis(text, last?.emojis ?? [], [type.body, { color: mine ? colors.buttonTextColor : colors.textPrimary }], 14)}
                            </Text>
                        </View>
                    </View>
                </View>
            </Pressable>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.borderColor, backgroundColor: colors.cardBackground }]}>
                <IconButton icon="arrow-back" accessibilityLabel={t('common.goBack')} onPress={onBack} />
                <View style={styles.headerTitle} accessible accessibilityRole="header">
                    <Avatar name={names} uri={people[0]?.avatar} size={32} />
                    <View style={styles.flex}>
                        <View>
                            {renderTextWithEmojis(names, people.flatMap(account => account.emojis || []), [type.name, { color: colors.textPrimary }], 15)}
                        </View>
                        <Text style={[type.meta, { color: colors.textMuted }]}>{tn('conversations.threadCount', threads.length)}</Text>
                    </View>
                </View>
            </View>
            {/* Only the threads Messages has loaded so far; older ones join as you scroll there */}
            <FlashList data={threads} keyExtractor={item => item.id} renderItem={renderThread} contentContainerStyle={styles.list} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        paddingBottom: space.sm,
        paddingHorizontal: space.lg,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerTitle: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
    },
    flex: {
        flex: 1,
    },
    list: {
        paddingTop: space.md,
        paddingHorizontal: space.lg,
        paddingBottom: TAB_BAR_CLEARANCE,
    },
    card: {
        borderWidth: 1,
        borderRadius: radii.card,
        padding: space.md,
        marginBottom: space.md,
        gap: space.md,
    },
    cardTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
    },
    number: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        borderRadius: radii.pill,
        paddingHorizontal: space.sm,
        paddingVertical: 2,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: radii.pill,
    },
    message: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: space.sm,
    },
    messageMine: {
        justifyContent: 'flex-end',
    },
    bubbleColumn: {
        flexShrink: 1,
        gap: 2,
        maxWidth: '85%',
    },
    bubbleColumnMine: {
        alignItems: 'flex-end',
    },
    bubble: {
        borderRadius: radii.well,
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
    },
    // The corner nearest the speaker stays sharp, like a speech bubble's tail
    bubbleMine: {
        borderBottomRightRadius: space.xs,
    },
    bubbleTheirs: {
        borderBottomLeftRadius: space.xs,
    },
});

export default ConversationGroupScreen;
