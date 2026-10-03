import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../services/themeContext';
import { useThemedStyles } from '../../services/theme/useThemedStyles';
import { hitSlopFor } from '../../services/theme/shape';
import { IconButton, SectionLabel, ThemedSwitch, Well } from '../ui';
import { OptionSheet, SheetOption } from './optionSheet';
import { makeStyles } from './styles';
import { useI18n } from '../../services/i18n/i18nContext';

export const DEFAULT_POLL_DURATION = 86400;

// Mastodon's own choices, in seconds
export const POLL_DURATIONS = [
    { value: 300, key: 'pollEditor.minutes5' },
    { value: 1800, key: 'pollEditor.minutes30' },
    { value: 3600, key: 'pollEditor.hour1' },
    { value: 21600, key: 'pollEditor.hours6' },
    { value: 86400, key: 'pollEditor.day1' },
    { value: 259200, key: 'pollEditor.days3' },
    { value: 604800, key: 'pollEditor.days7' },
] as const;

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
    const { t } = useI18n();
    const durations: SheetOption<number>[] = POLL_DURATIONS.map(({ value, key }) => ({ value, label: t(key) }));
    const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
    const [durationSheetVisible, setDurationSheetVisible] = useState(false);
    const durationLabel = durations.find(option => option.value === duration)?.label ?? t('pollEditor.day1');

    const setOption = (index: number, value: string) =>
        onChangeOptions(options.map((option, i) => (i === index ? value : option)));

    return (
        <Well style={styles.poll}>
            <View style={styles.pollHeader}>
                <SectionLabel>{t('pollEditor.title')}</SectionLabel>
                <IconButton icon="close" size={18} accessibilityLabel={t('pollEditor.remove')} onPress={onRemove} color={colors.textMuted} style={styles.pollRemove} />
            </View>

            {options.map((option, index) => (
                <View key={index} style={styles.choiceRow}>
                    <TextInput
                        style={[type.name, styles.choice, focusedIndex === index && styles.choiceFocused]}
                        placeholder={t('pollEditor.choice', { index: index + 1 })}
                        accessibilityLabel={t('pollEditor.choice', { index: index + 1 })}
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
                            accessibilityLabel={t('pollEditor.removeChoice', { index: index + 1 })}
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
                    accessibilityLabel={t('pollEditor.addChoice')}
                    style={({ pressed }) => [styles.addChoice, pressed && { opacity: 0.6 }]}
                >
                    <Ionicons name="add" size={16} color={colors.accentText} />
                    <Text style={[type.name, styles.addChoiceText]}>{t('pollEditor.addChoice')}</Text>
                </Pressable>
            )}

            {error && <Text style={[type.meta, styles.pollError]}>{error}</Text>}

            <View style={styles.pollFooter}>
                <Pressable
                    onPress={() => setDurationSheetVisible(true)}
                    accessibilityRole="button"
                    accessibilityLabel={t('pollEditor.lengthLabel', { value: durationLabel })}
                    hitSlop={hitSlopFor(0, 34)}
                    style={({ pressed }) => [styles.duration, pressed && { opacity: 0.7 }]}
                >
                    <Ionicons name="time-outline" size={15} color={colors.textPrimary} />
                    <Text style={[type.name, styles.durationText]}>{t('pollEditor.endsIn', { value: durationLabel })}</Text>
                    <Ionicons name="chevron-down" size={12} color={colors.textSecondary} />
                </Pressable>
                <View style={styles.multiple}>
                    <Text style={[type.name, styles.multipleText]} importantForAccessibility="no" accessibilityElementsHidden>
                        {t('pollEditor.multiple')}
                    </Text>
                    <ThemedSwitch value={multiple} onValueChange={onChangeMultiple} accessibilityLabel={t('pollEditor.multiple')} />
                </View>
            </View>

            <OptionSheet
                visible={durationSheetVisible}
                title={t('pollEditor.length')}
                options={durations}
                value={duration}
                onSelect={onChangeDuration}
                onClose={() => setDurationSheetVisible(false)}
            />
        </Well>
    );
};
