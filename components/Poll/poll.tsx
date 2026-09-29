import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Poll as PollType, PollOption } from '../../services/mastodon/types';
import { votePoll } from '../../services/mastodon/polls';
import { useTheme } from '../../services/themeContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRecyclingState } from '@shopify/flash-list';
import { styles } from './styles';
import { renderTextWithEmojis } from '../../services/emojiHelper';

interface PollProps {
    initialPoll: PollType;
    onPollUpdated?: (poll: PollType) => void;
}

export const Poll: React.FC<PollProps> = ({ initialPoll, onPollUpdated }) => {
    const { colors } = useTheme();
    // Reset when the parent card is recycled for a status with a different poll
    const [poll, setPoll] = useRecyclingState<PollType>(initialPoll, [initialPoll.id]);
    const [selectedChoices, setSelectedChoices] = useRecyclingState<number[]>([], [initialPoll.id]);
    const [isVoting, setIsVoting] = useRecyclingState(false, [initialPoll.id]);

    // Lets the vote handler skip state updates if the card was recycled while voting
    const renderedPollId = useRef(initialPoll.id);
    renderedPollId.current = initialPoll.id;

    const isClosed = poll.expired || poll.voted;
    const totalVotes = poll.voters_count || poll.votes_count || 0;

    const toggleChoice = (index: number) => {
        if (poll.multiple) {
            if (selectedChoices.includes(index)) {
                setSelectedChoices(selectedChoices.filter(i => i !== index));
            } else {
                setSelectedChoices([...selectedChoices, index]);
            }
        } else {
            setSelectedChoices([index]);
        }
    };

    const handleVote = async () => {
        if (selectedChoices.length === 0) return;
        const pollId = poll.id;
        setIsVoting(true);
        try {
            const updatedPoll = await votePoll(pollId, { choices: selectedChoices });
            onPollUpdated?.(updatedPoll);
            if (renderedPollId.current === pollId) {
                setPoll(updatedPoll);
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to submit vote. Please try again.');
        } finally {
            if (renderedPollId.current === pollId) {
                setIsVoting(false);
            }
        }
    };

    const renderOption = (option: PollOption, index: number) => {
        const votesCount = option.votes_count || 0;
        const percent = totalVotes > 0 ? Math.round((votesCount / totalVotes) * 100) : 0;
        const isSelected = selectedChoices.includes(index);
        const hasVotedForThis = poll.own_votes?.includes(index);

        return (
            <View key={index} style={styles.optionContainer}>
                {isClosed ? (
                    <View>
                        <View style={styles.optionTextContainer}>
                            {renderTextWithEmojis(
                                option.title,
                                poll.emojis,
                                [styles.optionTitle, { color: colors.textPrimary }, hasVotedForThis && { fontWeight: 'bold' }]
                            )}
                            <Text style={[styles.optionPercent, { color: colors.textSecondary }]}>
                                {percent}%
                            </Text>
                        </View>
                        <View style={[styles.progressBarBackground, { backgroundColor: colors.borderColor }]}>
                            <View style={[styles.progressBarFill, { width: `${percent}%`, backgroundColor: colors.accentColor }]} />
                        </View>
                    </View>
                ) : (
                    <TouchableOpacity
                        style={styles.optionTouchable}
                        onPress={() => toggleChoice(index)}
                        disabled={isVoting}
                    >
                        <View style={[
                            styles.checkbox,
                            { borderColor: colors.accentColor },
                            poll.multiple && styles.checkboxMultiple,
                            isSelected && [styles.checkboxSelected, { backgroundColor: colors.accentColor }]
                        ]}>
                            {isSelected && (
                                <Ionicons name="checkmark" size={14} color={colors.buttonTextColor} />
                            )}
                        </View>
                        {renderTextWithEmojis(
                            option.title,
                            poll.emojis,
                            [styles.optionTitle, { color: colors.textPrimary }]
                        )}
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {poll.options.map(renderOption)}
            
            <View style={styles.footer}>
                <Text style={[styles.footerText, { color: colors.textMuted }]}>
                    {poll.votes_count} votes
                </Text>
                {poll.expires_at && !poll.expired && (
                    <Text style={[styles.footerText, { color: colors.textMuted }]}>
                        {' · Ends soon'}
                    </Text>
                )}
                {poll.expired && (
                    <Text style={[styles.footerText, { color: colors.textMuted }]}>
                        {' · Closed'}
                    </Text>
                )}
            </View>

            {!isClosed && (
                <TouchableOpacity
                    style={[
                        styles.voteButton,
                        { backgroundColor: selectedChoices.length > 0 ? colors.accentColor : colors.borderColor }
                    ]}
                    onPress={handleVote}
                    disabled={isVoting || selectedChoices.length === 0}
                >
                    <Text style={[
                        styles.voteButtonText,
                        { color: selectedChoices.length > 0 ? colors.buttonTextColor : colors.textMuted }
                    ]}>
                        Vote
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
};
