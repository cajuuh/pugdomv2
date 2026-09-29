import React, { useRef } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRecyclingState } from '@shopify/flash-list';
import { Poll as PollType, PollOption } from '../../services/mastodon/types';
import { votePoll } from '../../services/mastodon/polls';
import { useTheme } from '../../services/themeContext';
import { useThemedStyles } from '../../services/theme/useThemedStyles';
import { renderTextWithEmojis } from '../../services/emojiHelper';
import { PillButton, Well } from '../ui';
import { makeStyles } from './styles';

interface PollProps {
    initialPoll: PollType;
    onPollUpdated?: (poll: PollType) => void;
}

// "18h left", "3d left", "5m left"; "Closed" once the poll has ended
export const pollTimeLeft = (poll: Pick<PollType, 'expired' | 'expires_at'>, now = Date.now()) => {
    if (poll.expired) return 'Closed';
    if (!poll.expires_at) return null;
    const minutes = Math.floor((new Date(poll.expires_at).getTime() - now) / 60000);
    if (minutes <= 0) return 'Closed';
    if (minutes < 60) return `${minutes}m left`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h left`;
    return `${Math.floor(hours / 24)}d left`;
};

// Past this width the winner's bar sits under its label, so the label can use the on-accent ink
// (which is light for black pug and would vanish on the surface beyond a short bar)
const ON_ACCENT_LABEL_MIN_PERCENT = 60;

export const Poll: React.FC<PollProps> = ({ initialPoll, onPollUpdated }) => {
    const { colors, type } = useTheme();
    const styles = useThemedStyles(makeStyles);
    // Reset when the parent card is recycled for a status with a different poll
    const [poll, setPoll] = useRecyclingState<PollType>(initialPoll, [initialPoll.id]);
    const [selectedChoices, setSelectedChoices] = useRecyclingState<number[]>([], [initialPoll.id]);
    const [isVoting, setIsVoting] = useRecyclingState(false, [initialPoll.id]);

    // Lets the vote handler skip state updates if the card was recycled while voting
    const renderedPollId = useRef(initialPoll.id);
    renderedPollId.current = initialPoll.id;

    const isClosed = poll.expired || poll.voted;
    const totalVotes = poll.voters_count || poll.votes_count || 0;
    const topVotes = Math.max(0, ...poll.options.map(option => option.votes_count || 0));

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

    const renderResult = (option: PollOption, index: number) => {
        const votesCount = option.votes_count || 0;
        const percent = totalVotes > 0 ? Math.round((votesCount / totalVotes) * 100) : 0;
        const isWinner = totalVotes > 0 && votesCount === topVotes;
        const isOwnVote = poll.own_votes?.includes(index);
        const labelOnAccent = isWinner && percent >= ON_ACCENT_LABEL_MIN_PERCENT;

        return (
            <View
                key={index}
                style={styles.result}
                accessible
                accessibilityLabel={`${option.title}, ${percent} percent${isOwnVote ? ', your vote' : ''}`}
            >
                <View style={[styles.resultBar, isWinner && styles.resultBarWinner, { width: `${percent}%` }]} />
                <View style={styles.resultLabels}>
                    {renderTextWithEmojis(
                        option.title,
                        poll.emojis,
                        [isWinner ? type.name : type.body, styles.resultTitle, labelOnAccent && styles.resultTitleOnAccent],
                        14
                    )}
                    {isOwnVote && (
                        <Ionicons name="checkmark" size={16} color={labelOnAccent ? colors.buttonTextColor : colors.accentText} />
                    )}
                    <Text style={[type.name, styles.resultPercent, isWinner && styles.resultPercentWinner]}>{percent}%</Text>
                </View>
            </View>
        );
    };

    const renderChoice = (option: PollOption, index: number) => {
        const isSelected = selectedChoices.includes(index);
        return (
            <Pressable
                key={index}
                style={[styles.option, isSelected && styles.optionSelected]}
                onPress={() => toggleChoice(index)}
                disabled={isVoting}
                accessibilityRole={poll.multiple ? 'checkbox' : 'radio'}
                accessibilityLabel={option.title}
                accessibilityState={{ checked: isSelected, disabled: isVoting }}
            >
                <View style={[styles.indicator, poll.multiple && styles.indicatorMultiple, isSelected && styles.indicatorSelected]}>
                    {isSelected && <Ionicons name="checkmark" size={12} color={colors.buttonTextColor} />}
                </View>
                {renderTextWithEmojis(
                    option.title,
                    poll.emojis,
                    [isSelected ? type.name : type.body, styles.optionTitle],
                    14.5
                )}
            </Pressable>
        );
    };

    const timeLeft = pollTimeLeft(poll);
    const summary = [`${poll.votes_count} ${poll.votes_count === 1 ? 'vote' : 'votes'}`, timeLeft].filter(Boolean).join(' · ');

    return (
        <Well style={styles.container} accessibilityRole={isClosed ? undefined : poll.multiple ? undefined : 'radiogroup'}>
            {poll.options.map(isClosed ? renderResult : renderChoice)}

            <View style={styles.footer}>
                <Text style={[type.meta, styles.footerText]}>{summary}</Text>
                {!isClosed && (
                    <PillButton
                        label="Vote"
                        onPress={handleVote}
                        loading={isVoting}
                        disabled={selectedChoices.length === 0}
                    />
                )}
            </View>
        </Well>
    );
};
