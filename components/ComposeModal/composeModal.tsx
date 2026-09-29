import React, { useState, useEffect, useRef } from 'react';
import {
    Modal,
    TextInput,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    DeviceEventEmitter,
    Alert,
    Platform,
    KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, Avatar } from 'react-native-ui-lib';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../../services/authContext';
import { useTheme } from '../../services/themeContext';
import { createStatus } from '../../services/mastodon/statuses';
import { makeStyles } from './styles';
import { useThemedStyles } from '../../services/theme/useThemedStyles';
import { ThemedSwitch } from '../ui';

const stripHtml = (html: string) => {
    if (!html) return '';
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<[^>]*>/g, '')
        .trim();
};

// Mastodon expects ISO 639-1 codes; region variants like en-US are ignored and the post falls
// back to the account's default language
export const LANGUAGES = [
    { code: 'en', label: 'English' },
    { code: 'pt', label: 'Português' },
    { code: 'es', label: 'Español' },
    { code: 'fr', label: 'Français' },
    { code: 'de', label: 'Deutsch' },
];

import { Account, Status } from '../../services/mastodon/types';
import { renderTextWithEmojis } from '../../services/emojiHelper';
import { replyMentionsText } from '../../services/mastodon/mentions';
import { statusLength } from '../../services/mastodon/statusLength';
import { useInstanceConfiguration } from '../../hooks/useInstanceConfiguration';

const deviceLanguage = () => {
    try {
        return Intl.DateTimeFormat().resolvedOptions().locale.split('-')[0];
    } catch {
        return undefined;
    }
};

// The account's default posting language, else the device language, else English
export const defaultLanguage = (user: Account | null) =>
    [user?.source?.language, deviceLanguage()].find(code => code && LANGUAGES.some(l => l.code === code)) ?? 'en';

// Mastodon rejects polls with fewer than two choices or repeated choices
const pollValidationError = (options: string[]) => {
    const filled = options.map(option => option.trim()).filter(option => option.length > 0);
    if (filled.length < 2) {
        return 'Add at least 2 choices';
    }
    if (new Set(filled).size !== filled.length) {
        return 'Choices must be different';
    }
    return null;
};

interface ComposeModalProps {
    isOpen: boolean;
    replyToStatus: Status | null;
    closeCompose: () => void;
}

const ComposeModal: React.FC<ComposeModalProps> = ({ isOpen, replyToStatus, closeCompose }) => {
    const { user } = useAuth();
    const { colors } = useTheme();
    const styles = useThemedStyles(makeStyles);
    // The modal is always mounted, so only load the instance limits while composing
    const instanceConfiguration = useInstanceConfiguration(isOpen && !!user);

    const [text, setText] = useState('');
    const [sensitive, setSensitive] = useState(false);
    const [spoilerText, setSpoilerText] = useState('');
    const [loading, setLoading] = useState(false);
    
    // Helper States
    const [language, setLanguage] = useState(() => defaultLanguage(user));
    const [langModalVisible, setLangModalVisible] = useState(false);

    // Poll States
    const [showPoll, setShowPoll] = useState(false);
    const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
    const [pollDuration, setPollDuration] = useState<number>(86400); // 1 day in seconds
    const [pollMultiple, setPollMultiple] = useState(false);

    const inputRef = useRef<TextInput>(null);

    useEffect(() => {
        if (isOpen) {
            setText(replyToStatus ? replyMentionsText(replyToStatus, user) : '');
            setSensitive(false);
            setSpoilerText('');
            setLanguage(defaultLanguage(user));
            setLoading(false);
            setShowPoll(false);
            setPollOptions(['', '']);
            setPollDuration(86400);
            setPollMultiple(false);
            
            // Focus on mount/open
            const timer = setTimeout(() => {
                inputRef.current?.focus();
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [isOpen, replyToStatus]);

    if (!isOpen) return null;

    const remaining = instanceConfiguration.maxCharacters - statusLength(text, sensitive ? spoilerText : '');
    const isOverLimit = remaining < 0;
    const isEmpty = text.trim().length === 0;
    const pollError = showPoll ? pollValidationError(pollOptions) : null;
    const isPublishDisabled = isEmpty || isOverLimit || !!pollError || loading;

    // Determine character counter color
    let counterColor = colors.textSecondary;
    if (remaining < 50 && remaining >= 0) {
        counterColor = colors.accentText;
    } else if (isOverLimit) {
        counterColor = colors.dangerColor; // Error red
    }

    const handlePublish = async () => {
        if (isPublishDisabled) return;
        setLoading(true);
        const pollParams = showPoll
            ? {
                options: pollOptions.map(opt => opt.trim()).filter(opt => opt.length > 0),
                expires_in: pollDuration,
                multiple: pollMultiple
            }
            : undefined;

        try {
            await createStatus({
                status: text,
                in_reply_to_id: replyToStatus ? replyToStatus.id : null,
                sensitive,
                spoiler_text: sensitive ? spoilerText : undefined,
                language: language,
                visibility: replyToStatus ? replyToStatus.visibility : 'public',
                poll: pollParams,
            });

            DeviceEventEmitter.emit('status_published');
            closeCompose();
        } catch (error: any) {
            console.error('Failed to post status:', error);
            Alert.alert(
                'Publishing Failed',
                error.response?.data?.error || error.message || 'An error occurred while publishing your status.'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            visible={isOpen}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={closeCompose}
        >
            <SafeAreaProvider>
                <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
                <KeyboardAvoidingView 
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
                    style={{ flex: 1 }}
                >
                    {/* Header */}
                    <View style={[styles.header, { backgroundColor: colors.cardBackground, borderBottomColor: colors.borderColor }]}>
                        <TouchableOpacity onPress={closeCompose} style={styles.headerButton}>
                            <Text style={[styles.headerButtonText, { color: colors.textSecondary }]}>Cancel</Text>
                        </TouchableOpacity>

                        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                            {replyToStatus ? 'Reply' : 'New Post'}
                        </Text>

                        <TouchableOpacity
                            onPress={handlePublish}
                            disabled={isPublishDisabled}
                            style={[
                                styles.publishButton,
                                { backgroundColor: colors.accentColor },
                                isPublishDisabled && styles.publishButtonDisabled
                            ]}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color={colors.buttonTextColor} />
                            ) : (
                                <Text style={[styles.publishButtonText, { color: colors.buttonTextColor }]}>Post</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Helper Input Bar (Language selection only) */}
                    <View style={[styles.helperBar, { backgroundColor: colors.cardBackground, borderBottomColor: colors.borderColor }]}>
                        {(() => {
                            const selectedLang = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];
                            return (
                                <TouchableOpacity
                                    style={[styles.langPill, { backgroundColor: colors.background, borderColor: colors.borderColor }]}
                                    onPress={() => setLangModalVisible(true)}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="globe-outline" size={13} color={colors.accentColor} />
                                    <Text style={[styles.langPillText, { color: colors.textPrimary }]}>
                                        {selectedLang.code}
                                    </Text>
                                    <Ionicons name="chevron-down" size={10} color={colors.textSecondary} />
                                </TouchableOpacity>
                            );
                        })()}
                    </View>

                    {/* Editor Space */}
                    <ScrollView
                        style={[styles.scrollContainer, { backgroundColor: colors.background }]}
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Parent Status Preview if Reply */}
                        {replyToStatus && (
                            <View style={[styles.replyPreview, { backgroundColor: colors.cardBackground, borderColor: colors.borderColor }]}>
                                <View style={styles.replyHeader}>
                                    <Avatar source={{ uri: replyToStatus.account.avatar }} size={24} />
                                    <View>
                                        <Text style={[styles.replyDisplayName, { color: colors.textPrimary }]} numberOfLines={1}>
                                            {renderTextWithEmojis(
                                                replyToStatus.account.display_name || replyToStatus.account.username,
                                                replyToStatus.account.emojis,
                                                styles.replyDisplayName
                                            )}
                                        </Text>
                                        <Text style={[styles.replyUsername, { color: colors.textSecondary }]} numberOfLines={1}>
                                            @{replyToStatus.account.acct}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={[styles.replyContent, { color: colors.textSecondary }]} numberOfLines={3}>
                                    {stripHtml(replyToStatus.content)}
                                </Text>
                            </View>
                        )}

                        {/* Author Info */}
                        {user && (
                            <View style={styles.authorSection}>
                                <Avatar source={{ uri: user.avatar }} size={36} />
                                <View>
                                    <Text style={[styles.authorName, { color: colors.textPrimary }]}>
                                        {renderTextWithEmojis(
                                            user.display_name || user.username,
                                            user.emojis,
                                            styles.authorName
                                        )}
                                    </Text>
                                </View>
                            </View>
                        )}

                        {/* Sensitive CW field */}
                        {sensitive && (
                            <View style={styles.spoilerInputContainer}>
                                <TextInput
                                    style={[
                                        styles.spoilerInput,
                                        {
                                            backgroundColor: colors.cardBackground,
                                            borderColor: colors.borderColor,
                                            color: colors.textPrimary
                                        }
                                    ]}
                                    placeholder="Write your content warning here..."
                                    placeholderTextColor={colors.textMuted}
                                    value={spoilerText}
                                    onChangeText={setSpoilerText}
                                    maxLength={100}
                                />
                            </View>
                        )}

                        {/* Compose Text Field */}
                        <TextInput
                            ref={inputRef}
                            style={[styles.textArea, { color: colors.textPrimary }]}
                            placeholder={replyToStatus ? "Write your reply..." : "What's on your mind?"}
                            placeholderTextColor={colors.textMuted}
                            multiline={true}
                            value={text}
                            onChangeText={setText}
                        />

                        {/* Poll Creation UI */}
                        {showPoll && (
                            <View style={[styles.pollContainer, { backgroundColor: colors.cardBackground, borderColor: colors.borderColor }]}>
                                {pollOptions.map((option, index) => (
                                    <View key={index} style={styles.pollOptionRow}>
                                        <TextInput
                                            style={[styles.pollInput, { color: colors.textPrimary, borderColor: colors.borderColor }]}
                                            placeholder={`Choice ${index + 1}`}
                                            placeholderTextColor={colors.textMuted}
                                            value={option}
                                            onChangeText={(text) => {
                                                const newOptions = [...pollOptions];
                                                newOptions[index] = text;
                                                setPollOptions(newOptions);
                                            }}
                                            maxLength={instanceConfiguration.maxCharactersPerPollOption}
                                        />
                                        {pollOptions.length > 2 && (
                                            <TouchableOpacity
                                                style={styles.pollRemoveButton}
                                                onPress={() => {
                                                    const newOptions = [...pollOptions];
                                                    newOptions.splice(index, 1);
                                                    setPollOptions(newOptions);
                                                }}
                                            >
                                                <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                ))}
                                {pollOptions.length < instanceConfiguration.maxPollOptions && (
                                    <TouchableOpacity
                                        style={styles.pollAddChoiceButton}
                                        onPress={() => {
                                            setPollOptions([...pollOptions, '']);
                                        }}
                                    >
                                        <Ionicons name="add" size={16} color={colors.accentText} />
                                        <Text style={[styles.pollAddChoiceText, { color: colors.accentText }]}>Add Choice</Text>
                                    </TouchableOpacity>
                                )}

                                {pollError && (
                                    <Text style={[styles.pollError, { color: colors.dangerColor }]}>{pollError}</Text>
                                )}

                                <View style={styles.pollSettingsRow}>
                                    <Text style={[styles.pollSettingsLabel, { color: colors.textPrimary }]}>Poll Duration:</Text>
                                    <View style={styles.pollDurationSelector}>
                                        {[
                                            { label: '1h', value: 3600 },
                                            { label: '1d', value: 86400 },
                                            { label: '1w', value: 604800 },
                                        ].map(dur => (
                                            <TouchableOpacity
                                                key={dur.value}
                                                style={[
                                                    styles.pollDurationPill,
                                                    pollDuration === dur.value && { backgroundColor: colors.accentColor }
                                                ]}
                                                onPress={() => setPollDuration(dur.value)}
                                            >
                                                <Text style={[
                                                    styles.pollDurationText,
                                                    { color: pollDuration === dur.value ? colors.buttonTextColor : colors.textSecondary }
                                                ]}>{dur.label}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                <View style={styles.pollSettingsRow}>
                                    <Text style={[styles.pollSettingsLabel, { color: colors.textPrimary }]}>Multiple choice</Text>
                                    <ThemedSwitch value={pollMultiple} onValueChange={setPollMultiple} accessibilityLabel="Multiple choice" />
                                </View>
                            </View>
                        )}
                    </ScrollView>

                    {/* Bottom Accessory Bar */}
                    <View style={[styles.footer, { backgroundColor: colors.cardBackground, borderTopColor: colors.borderColor }]}>
                        <View style={styles.leftAccessoryRow}>
                            {/* Media selector button */}
                            <TouchableOpacity
                                style={styles.accessoryButton}
                                onPress={() => Alert.alert('Add Media', 'Media attachments feature coming soon!')}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="image-outline" size={20} color={colors.textSecondary} />
                            </TouchableOpacity>

                            {/* Sensitive / CW eye toggle button */}
                            <TouchableOpacity
                                style={styles.accessoryButton}
                                onPress={() => setSensitive(!sensitive)}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name={sensitive ? "eye-off-outline" : "eye-outline"}
                                    size={20}
                                    color={sensitive ? colors.accentColor : colors.textSecondary}
                                />
                            </TouchableOpacity>

                            {/* Poll button */}
                            <TouchableOpacity
                                testID="compose-poll-toggle"
                                accessibilityLabel="Add poll"
                                style={styles.accessoryButton}
                                onPress={() => {
                                    setShowPoll(!showPoll);
                                    if (showPoll) {
                                        // Reset when closing
                                        setPollOptions(['', '']);
                                        setPollDuration(86400);
                                        setPollMultiple(false);
                                    }
                                }}
                                activeOpacity={0.7}
                            >
                                <Ionicons 
                                    name={showPoll ? "stats-chart" : "stats-chart-outline"} 
                                    size={20} 
                                    color={showPoll ? colors.accentColor : colors.textSecondary} 
                                />
                            </TouchableOpacity>
                        </View>

                        {/* Character count */}
                        <Text style={[styles.charCounter, { color: counterColor }]}>
                            {remaining}
                        </Text>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </SafeAreaProvider>

            {/* Language Selection Modal Sheet */}
            <Modal
                visible={langModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setLangModalVisible(false)}
            >
                <TouchableOpacity
                    style={styles.langModalContainer}
                    activeOpacity={1}
                    onPress={() => setLangModalVisible(false)}
                >
                    <View style={[styles.langSheet, { backgroundColor: colors.cardBackground }]}>
                        <View style={styles.langSheetHeader}>
                            <Text style={[styles.langSheetTitle, { color: colors.textPrimary }]}>
                                Select Post Language
                            </Text>
                            <TouchableOpacity onPress={() => setLangModalVisible(false)}>
                                <Ionicons name="close" size={22} color={colors.textPrimary} />
                            </TouchableOpacity>
                        </View>
                        {LANGUAGES.map((item) => (
                            <TouchableOpacity
                                key={item.code}
                                style={[
                                    styles.langOption,
                                    { backgroundColor: language === item.code ? colors.background : 'transparent' }
                                ]}
                                onPress={() => {
                                    setLanguage(item.code);
                                    setLangModalVisible(false);
                                }}
                            >
                                <Text style={[styles.langOptionText, { color: colors.textPrimary }]}>
                                    {item.label} ({item.code})
                                </Text>
                                {language === item.code && (
                                    <Ionicons name="checkmark-sharp" size={16} color={colors.accentColor} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                </TouchableOpacity>
            </Modal>
        </Modal>
    );
};

export default ComposeModal;
