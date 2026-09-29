import React, { useState, useEffect, useRef } from 'react';
import {
    Alert,
    Animated,
    DeviceEventEmitter,
    Easing,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../../services/authContext';
import { useTheme } from '../../services/themeContext';
import { createStatus } from '../../services/mastodon/statuses';
import { Account, Status } from '../../services/mastodon/types';
import { renderTextWithEmojis } from '../../services/emojiHelper';
import { replyMentionsText } from '../../services/mastodon/mentions';
import { statusLength } from '../../services/mastodon/statusLength';
import { useInstanceConfiguration } from '../../hooks/useInstanceConfiguration';
import { useThemedStyles } from '../../services/theme/useThemedStyles';
import { hitSlopFor, space } from '../../services/theme/shape';
import { Avatar, IconButton, PillButton, Well } from '../ui';
import { CharacterCounter } from './characterCounter';
import { EmojiPicker } from './emojiPicker';
import { OptionSheet, SheetOption } from './optionSheet';
import { DEFAULT_POLL_DURATION, PollEditor } from './pollEditor';
import { PILL_HEIGHT, makeStyles } from './styles';

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

const LANGUAGE_OPTIONS: SheetOption<string>[] = LANGUAGES.map(({ code, label }) => ({ value: code, label, description: code.toUpperCase() }));

type Visibility = Status['visibility'];

// Mastodon calls followers-only "private" and mentioned-only "direct"
export const VISIBILITIES: (SheetOption<Visibility> & { icon: React.ComponentProps<typeof Ionicons>['name'] })[] = [
    { value: 'public', label: 'Public', description: 'Anyone, on or off Mastodon', icon: 'globe-outline' },
    { value: 'unlisted', label: 'Unlisted', description: 'Public, but not in public timelines or trends', icon: 'lock-open-outline' },
    { value: 'private', label: 'Followers', description: 'Only your followers', icon: 'lock-closed-outline' },
    { value: 'direct', label: 'Mentioned', description: 'Only the people you mention', icon: 'at' },
];

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

// Replies keep the parent's visibility; new posts use the account's default
export const defaultVisibility = (user: Account | null, replyToStatus: Status | null): Visibility =>
    replyToStatus?.visibility ?? user?.source?.privacy ?? 'public';

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

// Puts `insert` at the cursor, with spaces so it doesn't run into the surrounding words
const insertAt = (text: string, cursor: number, insert: string) => {
    const before = text.slice(0, cursor);
    const after = text.slice(cursor);
    const lead = before.length > 0 && !/\s$/.test(before) ? ' ' : '';
    const trail = /^\s/.test(after) ? '' : ' ';
    const piece = `${lead}${insert}${trail}`;
    return { text: before + piece + after, cursor: cursor + piece.length };
};

// iOS reports the keyboard before it moves, Android only after
const useKeyboardVisible = () => {
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setVisible(true));
        const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setVisible(false));
        return () => {
            show.remove();
            hide.remove();
        };
    }, []);
    return visible;
};

interface ComposeModalProps {
    isOpen: boolean;
    replyToStatus: Status | null;
    closeCompose: () => void;
}

const ComposeModal: React.FC<ComposeModalProps> = ({ isOpen, replyToStatus, closeCompose }) => {
    const { user } = useAuth();
    const { colors, type } = useTheme();
    const styles = useThemedStyles(makeStyles);
    const insets = useSafeAreaInsets();
    const { height: windowHeight } = useWindowDimensions();
    const keyboardVisible = useKeyboardVisible();
    // The modal is always mounted, so only load the instance limits while composing
    const instanceConfiguration = useInstanceConfiguration(isOpen && !!user);

    const [text, setText] = useState('');
    const [sensitive, setSensitive] = useState(false);
    const [spoilerText, setSpoilerText] = useState('');
    const [loading, setLoading] = useState(false);
    const [language, setLanguage] = useState(() => defaultLanguage(user));
    const [visibility, setVisibility] = useState<Visibility>(() => defaultVisibility(user, replyToStatus));
    const [picker, setPicker] = useState<'language' | 'visibility' | 'emoji' | null>(null);

    // Poll States
    const [showPoll, setShowPoll] = useState(false);
    const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
    const [pollDuration, setPollDuration] = useState<number>(DEFAULT_POLL_DURATION);
    const [pollMultiple, setPollMultiple] = useState(false);

    const inputRef = useRef<TextInput>(null);
    const cursor = useRef(0);

    // Stays mounted while the sheet slides away after closing
    const [mounted, setMounted] = useState(isOpen);
    const progress = useRef(new Animated.Value(0)).current;
    // closeCompose clears the reply right away; keep showing it while the sheet slides out
    const shownReply = useRef(replyToStatus);
    if (isOpen) shownReply.current = replyToStatus;
    const reply = shownReply.current;

    useEffect(() => {
        if (isOpen) {
            setMounted(true);
            Animated.timing(progress, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
        } else {
            Animated.timing(progress, { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true })
                .start(({ finished }) => finished && setMounted(false));
        }
    }, [isOpen, progress]);

    useEffect(() => {
        if (isOpen) {
            const initialText = replyToStatus ? replyMentionsText(replyToStatus, user) : '';
            setText(initialText);
            cursor.current = initialText.length;
            setSensitive(false);
            setSpoilerText('');
            setLanguage(defaultLanguage(user));
            setVisibility(defaultVisibility(user, replyToStatus));
            setLoading(false);
            setShowPoll(false);
            setPollOptions(['', '']);
            setPollDuration(DEFAULT_POLL_DURATION);
            setPollMultiple(false);
            setPicker(null);

            // Focus once the sheet is in place
            const timer = setTimeout(() => {
                inputRef.current?.focus();
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [isOpen, replyToStatus]);

    if (!mounted) return null;

    const remaining = instanceConfiguration.maxCharacters - statusLength(text, sensitive ? spoilerText : '');
    const isOverLimit = remaining < 0;
    const isEmpty = text.trim().length === 0;
    const pollError = showPoll ? pollValidationError(pollOptions) : null;
    const isPublishDisabled = isEmpty || isOverLimit || !!pollError || loading;
    const selectedVisibility = VISIBILITIES.find(v => v.value === visibility) ?? VISIBILITIES[0];
    const selectedLanguage = LANGUAGES.find(l => l.code === language) ?? LANGUAGES[0];

    const resetPoll = () => {
        setShowPoll(false);
        setPollOptions(['', '']);
        setPollDuration(DEFAULT_POLL_DURATION);
        setPollMultiple(false);
    };

    const insertEmoji = (shortcode: string) => {
        const next = insertAt(text, cursor.current, `:${shortcode}:`);
        setText(next.text);
        cursor.current = next.cursor;
    };

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
                in_reply_to_id: reply ? reply.id : null,
                sensitive,
                spoiler_text: sensitive ? spoilerText : undefined,
                language: language,
                visibility,
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

    const tool = (icon: React.ComponentProps<typeof Ionicons>['name'], label: string, onPress: () => void, active = false) => (
        <IconButton
            icon={icon}
            accessibilityLabel={label}
            onPress={onPress}
            selected={active}
            color={active ? colors.accentText : colors.textSecondary}
            style={[styles.tool, active && styles.toolActive]}
        />
    );

    const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [windowHeight, 0] });

    return (
        <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={closeCompose}>
            <View style={styles.root}>
                <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim, opacity: progress }]} />
                {/* On Android too: the app draws edge to edge, so the window no longer resizes for the keyboard */}
                <KeyboardAvoidingView behavior="padding" style={styles.keyboardAvoider}>
                    <Animated.View
                        accessibilityViewIsModal
                        style={[styles.sheet, { marginTop: insets.top + space.sm, transform: [{ translateY }] }]}
                    >
                        <View style={styles.grabberRow} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                            <View style={styles.grabber} />
                        </View>

                        <View style={styles.header}>
                            <View style={styles.headerSide}>
                                <PillButton label="Cancel" variant="ghost" onPress={closeCompose} style={styles.cancel} />
                            </View>
                            <Text accessibilityRole="header" style={[type.sheetTitle, styles.headerTitle]}>
                                {reply ? 'Reply' : 'New post'}
                            </Text>
                            <View style={[styles.headerSide, styles.headerSideEnd]}>
                                <PillButton label="Post" onPress={handlePublish} disabled={isPublishDisabled && !loading} loading={loading} />
                            </View>
                        </View>

                        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                            {reply && (
                                <Well style={styles.replyWell}>
                                    <View style={styles.replyHeader}>
                                        <Avatar name={reply.account.display_name || reply.account.username} uri={reply.account.avatar} size={24} />
                                        <View style={styles.replyNames}>
                                            <Text style={[type.name, styles.replyName]} numberOfLines={1}>
                                                {renderTextWithEmojis(
                                                    reply.account.display_name || reply.account.username,
                                                    reply.account.emojis,
                                                    [type.name, styles.replyName],
                                                    14
                                                )}
                                            </Text>
                                            <Text style={[type.meta, styles.replyHandle]} numberOfLines={1}>@{reply.account.acct}</Text>
                                        </View>
                                    </View>
                                    <Text style={[type.body, styles.replyContent]} numberOfLines={3}>
                                        {stripHtml(reply.content)}
                                    </Text>
                                </Well>
                            )}

                            {user && (
                                <View style={styles.author}>
                                    <Avatar name={user.display_name || user.username} uri={user.avatar} size={42} />
                                    <View style={styles.authorDetails}>
                                        <Text style={[type.name, styles.authorName]} numberOfLines={1}>
                                            {renderTextWithEmojis(user.display_name || user.username, user.emojis, [type.name, styles.authorName])}
                                        </Text>
                                        <View style={styles.pills}>
                                            <Pressable
                                                onPress={() => setPicker('visibility')}
                                                accessibilityRole="button"
                                                accessibilityLabel={`Visibility: ${selectedVisibility.label}`}
                                                hitSlop={hitSlopFor(0, PILL_HEIGHT)}
                                                style={({ pressed }) => [styles.pill, pressed && { opacity: 0.7 }]}
                                            >
                                                <Ionicons name={selectedVisibility.icon} size={14} color={colors.accentText} />
                                                <Text style={[type.name, styles.pillText]}>{selectedVisibility.label}</Text>
                                                <Ionicons name="chevron-down" size={12} color={colors.textSecondary} />
                                            </Pressable>
                                            <Pressable
                                                onPress={() => setPicker('language')}
                                                accessibilityRole="button"
                                                accessibilityLabel={`Language: ${selectedLanguage.label}`}
                                                hitSlop={hitSlopFor(0, PILL_HEIGHT)}
                                                style={({ pressed }) => [styles.pill, pressed && { opacity: 0.7 }]}
                                            >
                                                <Text style={[type.name, styles.pillText]}>
                                                    {selectedLanguage.code.toUpperCase()} · {selectedLanguage.label}
                                                </Text>
                                                <Ionicons name="chevron-down" size={12} color={colors.textSecondary} />
                                            </Pressable>
                                        </View>
                                    </View>
                                </View>
                            )}

                            {sensitive && (
                                <View style={styles.contentWarning}>
                                    <Ionicons name="warning-outline" size={18} color={colors.accentText} />
                                    <TextInput
                                        style={[type.body, styles.contentWarningInput]}
                                        placeholder="Content warning"
                                        accessibilityLabel="Content warning"
                                        placeholderTextColor={colors.textMuted}
                                        value={spoilerText}
                                        onChangeText={setSpoilerText}
                                        maxLength={100}
                                    />
                                </View>
                            )}

                            <TextInput
                                ref={inputRef}
                                style={[type.body, styles.textArea]}
                                placeholder={reply ? 'Write your reply...' : "What's on your mind?"}
                                accessibilityLabel="Post text"
                                placeholderTextColor={colors.textMuted}
                                multiline
                                value={text}
                                onChangeText={setText}
                                onSelectionChange={event => {
                                    cursor.current = event.nativeEvent.selection.end;
                                }}
                            />

                            {showPoll && (
                                <PollEditor
                                    options={pollOptions}
                                    onChangeOptions={setPollOptions}
                                    duration={pollDuration}
                                    onChangeDuration={setPollDuration}
                                    multiple={pollMultiple}
                                    onChangeMultiple={setPollMultiple}
                                    maxOptions={instanceConfiguration.maxPollOptions}
                                    maxCharactersPerOption={instanceConfiguration.maxCharactersPerPollOption}
                                    error={pollError}
                                    onRemove={resetPoll}
                                />
                            )}
                        </ScrollView>

                        <View
                            accessibilityRole="toolbar"
                            style={[styles.toolbar, { paddingBottom: keyboardVisible ? 10 : Math.max(insets.bottom, 10) }]}
                        >
                            {tool('image-outline', 'Add media', () => Alert.alert('Add Media', 'Media attachments feature coming soon!'))}
                            {tool(showPoll ? 'stats-chart' : 'stats-chart-outline', 'Poll', () => (showPoll ? resetPoll() : setShowPoll(true)), showPoll)}
                            {tool('warning-outline', 'Content warning', () => setSensitive(!sensitive), sensitive)}
                            {tool('happy-outline', 'Custom emoji', () => setPicker('emoji'))}
                            <View style={styles.toolbarSpacer} />
                            <CharacterCounter remaining={remaining} max={instanceConfiguration.maxCharacters} />
                        </View>
                    </Animated.View>
                </KeyboardAvoidingView>
            </View>

            <OptionSheet
                visible={picker === 'visibility'}
                title="Who can see this"
                options={VISIBILITIES}
                value={visibility}
                onSelect={setVisibility}
                onClose={() => setPicker(null)}
            />
            <OptionSheet
                visible={picker === 'language'}
                title="Post language"
                options={LANGUAGE_OPTIONS}
                value={language}
                onSelect={setLanguage}
                onClose={() => setPicker(null)}
            />
            <EmojiPicker visible={picker === 'emoji'} onPick={insertEmoji} onClose={() => setPicker(null)} />
        </Modal>
    );
};

export default ComposeModal;
