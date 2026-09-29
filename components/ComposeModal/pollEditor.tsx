import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../services/themeContext';
import { useThemedStyles } from '../../services/theme/useThemedStyles';
import { hitSlopFor } from '../../services/theme/shape';
import { IconButton, SectionLabel, ThemedSwitch, Well } from '../ui';
import { OptionSheet, SheetOption } from './optionSheet';
import { makeStyles } from './styles';

export const DEFAULT_POLL_DURATION = 86400;

// Mastodon's own choices, in seconds
export const POLL_DURATIONS: SheetOption<number>[] = [
    { value: 300, label: '5 minutes' },
    { value: 1800, label: '30 minutes' },
    { value: 3600, label: '1 hour' },
    { value: 21600, label: '6 hours' },
    { value: 86400, label: '1 day' },
    { value: 259200, label: '3 days' },
    { value: 604800, label: '7 days' },
];

interface PollEditorProps {
    options: string[];
    onChangeOptions: (options: string[]) => void;
    duration: number;
    onChangeDuration: (seconds: number) => void;
    multiple: boolean;
    onChangeMultiple: (multiple: boolean) => void;
    maxOptions: number;
    maxCharactersPerOption: number;
    error: string | null;
    onRemove: () => void;
}

export const PollEditor: React.FC<PollEditorProps> = ({
    options,
    onChangeOptions,
    duration,
    onChangeDuration,
    multiple,
    onChangeMultiple,
    maxOptions,
    maxCharactersPerOption,
    error,
    onRemove,
}) => {
    const { colors, type } = useTheme();
    const styles = useThemedStyles(makeStyles);
    const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
    const [durationSheetVisible, setDurationSheetVisible] = useState(false);
    const durationLabel = POLL_DURATIONS.find(option => option.value === duration)?.label ?? '1 day';

    const setOption = (index: number, value: string) =>
        onChangeOptions(options.map((option, i) => (i === index ? value : option)));

    return (
        <Well style={styles.poll}>
            <View style={styles.pollHeader}>
                <SectionLabel>Poll</SectionLabel>
                <IconButton icon="close" size={18} accessibilityLabel="Remove poll" onPress={onRemove} color={colors.textMuted} style={styles.pollRemove} />
            </View>

            {options.map((option, index) => (
                <View key={index} style={styles.choiceRow}>
                    <TextInput
                        style={[type.name, styles.choice, focusedIndex === index && styles.choiceFocused]}
                        placeholder={`Choice ${index + 1}`}
                        accessibilityLabel={`Choice ${index + 1}`}
                        placeholderTextColor={colors.textMuted}
                        value={option}
                        onChangeText={value => setOption(index, value)}
                        onFocus={() => setFocusedIndex(index)}
                        onBlur={() => setFocusedIndex(current => (current === index ? null : current))}
                        maxLength={maxCharactersPerOption}
                    />
                    {options.length > 2 && (
                        <IconButton
                            icon="close-circle"
                            size={20}
                            accessibilityLabel={`Remove choice ${index + 1}`}
                            onPress={() => onChangeOptions(options.filter((_, i) => i !== index))}
                            color={colors.textMuted}
                        />
                    )}
                </View>
            ))}

            {options.length < maxOptions && (
                <Pressable
                    onPress={() => onChangeOptions([...options, ''])}
                    accessibilityRole="button"
                    accessibilityLabel="Add choice"
                    style={({ pressed }) => [styles.addChoice, pressed && { opacity: 0.6 }]}
                >
                    <Ionicons name="add" size={16} color={colors.accentText} />
                    <Text style={[type.name, styles.addChoiceText]}>Add choice</Text>
                </Pressable>
            )}

            {error && <Text style={[type.meta, styles.pollError]}>{error}</Text>}

            <View style={styles.pollFooter}>
                <Pressable
                    onPress={() => setDurationSheetVisible(true)}
                    accessibilityRole="button"
                    accessibilityLabel={`Poll length: ${durationLabel}`}
                    hitSlop={hitSlopFor(0, 34)}
                    style={({ pressed }) => [styles.duration, pressed && { opacity: 0.7 }]}
                >
                    <Ionicons name="time-outline" size={15} color={colors.textPrimary} />
                    <Text style={[type.name, styles.durationText]}>Ends in {durationLabel}</Text>
                    <Ionicons name="chevron-down" size={12} color={colors.textSecondary} />
                </Pressable>
                <View style={styles.multiple}>
                    <Text style={[type.name, styles.multipleText]} importantForAccessibility="no" accessibilityElementsHidden>
                        Multiple choice
                    </Text>
                    <ThemedSwitch value={multiple} onValueChange={onChangeMultiple} accessibilityLabel="Multiple choice" />
                </View>
            </View>

            <OptionSheet
                visible={durationSheetVisible}
                title="Poll length"
                options={POLL_DURATIONS}
                value={duration}
                onSelect={onChangeDuration}
                onClose={() => setDurationSheetVisible(false)}
            />
        </Well>
    );
};
