import React, { useState, useEffect, useRef } from 'react';
import {
    Alert,
    Animated,
    DeviceEventEmitter,
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
import { useDragToDismiss, useSheetTransition } from './sheetTransition';
import { PILL_HEIGHT, makeStyles } from './styles';
import { AttachmentStrip } from './attachmentStrip';
import { AltTextEditor } from './altTextEditor';
import { AltReminderSheet } from './altReminderSheet';
import { useMediaAttachments } from '../../hooks/useMediaAttachments';
import { pickImages, takePhoto } from '../../services/media/pick';
import { ImageEditor } from '../ImageEditor/imageEditor';
import { applyEdits } from '../../services/media/edit';
import { ImageEdits, Point, sameEdits } from '../../services/media/geometry';
import { PickedImage } from '../../services/media/prepare';
import { useI18n } from '../../services/i18n/i18nContext';
import { Translator } from '../../services/i18n/translate';

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
type VisibilityOption = SheetOption<Visibility> & { icon: React.ComponentProps<typeof Ionicons>['name'] };
export const visibilities = ({ t }: Translator): VisibilityOption[] => [
    { value: 'public', label: t('compose.public'), description: t('compose.publicDescription'), icon: 'globe-outline' },
    { value: 'unlisted', label: t('compose.unlisted'), description: t('compose.unlistedDescription'), icon: 'lock-open-outline' },
    { value: 'private', label: t('compose.followers'), description: t('compose.followersDescription'), icon: 'lock-closed-outline' },
    { value: 'direct', label: t('compose.mentioned'), description: t('compose.mentionedDescription'), icon: 'at' },
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
const pollValidationError = (options: string[], { t }: Translator) => {
    const filled = options.map(option => option.trim()).filter(option => option.length > 0);
    if (filled.length < 2) {
        return t('compose.minChoices');
    }
    if (new Set(filled).size !== filled.length) {
        return t('compose.distinctChoices');
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

// How much of the window the keyboard covers, measured up from the bottom edge
export const keyboardInset = (windowHeight: number, keyboardTop: number) => Math.max(windowHeight - keyboardTop, 0);

// iOS reports the keyboard before it moves, Android only after
const useKeyboard = (windowHeight: number) => {
    const [keyboard, setKeyboard] = useState({ visible: false, inset: 0 });
    useEffect(() => {
        const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', event =>
            setKeyboard({ visible: true, inset: keyboardInset(windowHeight, event.endCoordinates.screenY) })
        );
        const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () =>
            setKeyboard({ visible: false, inset: 0 })
        );
        return () => {
            show.remove();
            hide.remove();
        };
    }, [windowHeight]);
    return keyboard;
};

// Anything typed beyond the reply mentions the sheet opened with, a poll, a content warning or images
export const hasDraft = ({ text, initialText, showPoll, spoilerText, hasMedia = false }: { text: string; initialText: string; showPoll: boolean; spoilerText: string; hasMedia?: boolean }) =>
    text.trim() !== initialText.trim() || showPoll || spoilerText.trim().length > 0 || hasMedia;

interface ComposeModalProps {
    isOpen: boolean;
    replyToStatus: Status | null;
    closeCompose: () => void;
}

const ComposeModal: React.FC<ComposeModalProps> = ({ isOpen, replyToStatus, closeCompose }) => {
    const { user } = useAuth();
    const { colors, type } = useTheme();
    const i18n = useI18n();
    const { t } = i18n;
    const styles = useThemedStyles(makeStyles);
    const insets = useSafeAreaInsets();
    const { height: windowHeight } = useWindowDimensions();
    const keyboard = useKeyboard(windowHeight);
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

    const media = useMediaAttachments(instanceConfiguration);
    // The image whose description (and focal point) is being edited, shown in place of the post
    const [altEditing, setAltEditing] = useState<{ key: string; draft: string; focus?: Point } | null>(null);
    const [reminderOpen, setReminderOpen] = useState(false);
    // The image open in the editor: its original and the edits so far
    const [imageEditing, setImageEditing] = useState<{ key: string; original: PickedImage; edits: ImageEdits } | null>(null);
    // The pug asks about missing descriptions once per post
    const reminded = useRef(false);

    const inputRef = useRef<TextInput>(null);
    const cursor = useRef(0);

    const { mounted, progress } = useSheetTransition(isOpen);
    // The text the sheet opened with (reply mentions), to tell whether there's a draft to lose
    const initialText = useRef('');
    // closeCompose clears the reply right away; keep showing it while the sheet slides out
    const shownReply = useRef(replyToStatus);
    if (isOpen) shownReply.current = replyToStatus;
    const reply = shownReply.current;

    // Swiping the sheet down closes it, asking first if there's a draft
    const { drag, panHandlers } = useDragToDismiss(cancel => {
        if (!hasDraft({ text, initialText: initialText.current, showPoll, spoilerText, hasMedia: media.attachments.length > 0 })) {
            closeCompose();
            return;
        }
        Alert.alert(t('compose.discardTitle'), t('compose.discardMessage'), [
            { text: t('compose.keepEditing'), style: 'cancel', onPress: cancel },
            { text: t('compose.discard'), style: 'destructive', onPress: closeCompose },
        ], { cancelable: true, onDismiss: cancel });
    });

    useEffect(() => {
        if (isOpen) {
            const startText = replyToStatus ? replyMentionsText(replyToStatus, user) : '';
            initialText.current = startText;
            drag.setValue(0);
            setText(startText);
            cursor.current = startText.length;
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
            media.reset();
            setAltEditing(null);
            setImageEditing(null);
            setReminderOpen(false);
            reminded.current = false;

            // Focus once the sheet is in place
            const timer = setTimeout(() => {
                inputRef.current?.focus();
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [isOpen, replyToStatus, drag]);

    // Closing stops uploads that are still going
    const cancelUploads = media.cancel;
    useEffect(() => {
        if (!isOpen) cancelUploads();
    }, [isOpen, cancelUploads]);

    if (!mounted) return null;

    const remaining = instanceConfiguration.maxCharacters - statusLength(text, sensitive ? spoilerText : '');
    const isOverLimit = remaining < 0;
    // Images can be posted without text
    const isEmpty = text.trim().length === 0 && media.attachments.length === 0;
    const pollError = showPoll ? pollValidationError(pollOptions, i18n) : null;
    const isPublishDisabled = isEmpty || isOverLimit || !!pollError || media.pending || loading;
    const editingAttachment = altEditing ? media.attachments.find(attachment => attachment.key === altEditing.key) : undefined;
    const altOverLimit = !!altEditing && altEditing.draft.length > instanceConfiguration.descriptionLimit;
    const visibilityOptions = visibilities(i18n);
    const selectedVisibility = visibilityOptions.find(v => v.value === visibility) ?? visibilityOptions[0];
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

    const describeImage = (key: string) => {
        const attachment = media.attachments.find(item => item.key === key);
        if (attachment) setAltEditing({ key, draft: attachment.description, focus: attachment.focus });
    };

    const saveDescription = () => {
        if (!altEditing || altOverLimit) return;
        media.describe(altEditing.key, altEditing.draft);
        media.setFocus(altEditing.key, altEditing.focus);
        setAltEditing(null);
    };

    const editImage = (key: string) => {
        const history = media.editsFor(key);
        if (history) setImageEditing({ key, ...history });
    };

    // Applies the edits to the original and uploads the result in place of the last upload
    const finishEditing = async (edits: ImageEdits) => {
        if (!imageEditing) return;
        if (sameEdits(edits, imageEditing.edits)) {
            setImageEditing(null);
            return;
        }
        try {
            const edited = await applyEdits(imageEditing.original, edits);
            media.edit(imageEditing.key, edited, edits);
            setImageEditing(null);
        } catch (error) {
            console.warn('Could not edit the image:', error);
            Alert.alert(t('editor.failedTitle'), t('editor.failed'));
        }
    };

    const addFromLibrary = async () => {
        try {
            media.add(await pickImages(media.room));
        } catch (error) {
            console.warn('Could not open the gallery:', error);
        }
    };

    const addFromCamera = async () => {
        try {
            const photo = await takePhoto();
            if (photo === 'denied') {
                Alert.alert(t('compose.cameraDeniedTitle'), t('compose.cameraDenied'));
                return;
            }
            media.add(photo);
        } catch (error) {
            console.warn('Could not open the camera:', error);
        }
    };

    const handlePublish = async (skipReminder = false) => {
        if (isPublishDisabled) return;
        if (!skipReminder && !reminded.current && media.missingDescription.length > 0) {
            reminded.current = true;
            setReminderOpen(true);
            return;
        }
        setLoading(true);
        const pollParams = showPoll
            ? {
                options: pollOptions.map(opt => opt.trim()).filter(opt => opt.length > 0),
                expires_in: pollDuration,
                multiple: pollMultiple
            }
            : undefined;

        try {
            const mediaIds = await media.finish();
            await createStatus({
                status: text,
                in_reply_to_id: reply ? reply.id : null,
                sensitive,
                spoiler_text: sensitive ? spoilerText : undefined,
                language: language,
                visibility,
                poll: pollParams,
                media_ids: mediaIds.length > 0 ? mediaIds : undefined,
            });

            DeviceEventEmitter.emit('status_published');
            closeCompose();
        } catch (error: any) {
            console.error('Failed to post status:', error);
            Alert.alert(
                t('compose.publishFailed'),
                error.response?.data?.error || error.message || t('compose.publishFailedMessage')
            );
        } finally {
            setLoading(false);
        }
    };

    const tool = (icon: React.ComponentProps<typeof Ionicons>['name'], label: string, onPress: () => void, active = false, disabled = false) => (
        <IconButton
            icon={icon}
            accessibilityLabel={label}
            onPress={onPress}
            selected={active}
            disabled={disabled}
            color={active ? colors.accentText : colors.textSecondary}
            style={[styles.tool, active && styles.toolActive]}
        />
    );

    const translateY = Animated.add(progress.interpolate({ inputRange: [0, 1], outputRange: [windowHeight, 0] }), drag);

    const sheet = (
        <Animated.View
            accessibilityViewIsModal
            style={[styles.sheet, { marginTop: insets.top + space.sm, transform: [{ translateY }] }]}
        >
            {/* The grabber and header are the drag handle. Not collapsable: Android drops views that draw
                nothing, and touches would then land on the sheet behind the handle */}
            <View collapsable={false} {...panHandlers}>
                <View style={styles.grabberRow} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                    <View style={styles.grabber} />
                </View>

                <View style={styles.header}>
                    <View style={styles.headerSide}>
                        <PillButton
                            label={t('common.cancel')}
                            variant="ghost"
                            onPress={altEditing ? () => setAltEditing(null) : closeCompose}
                            style={styles.cancel}
                        />
                    </View>
                    <Text accessibilityRole="header" style={[type.sheetTitle, styles.headerTitle]} numberOfLines={1}>
                        {altEditing ? t('compose.describeTitle') : reply ? t('compose.reply') : t('compose.newPost')}
                    </Text>
                    <View style={[styles.headerSide, styles.headerSideEnd]}>
                        {altEditing ? (
                            <PillButton label={t('compose.done')} onPress={saveDescription} disabled={altOverLimit} />
                        ) : (
                            <PillButton label={t('compose.post')} onPress={() => handlePublish()} disabled={isPublishDisabled && !loading} loading={loading} />
                        )}
                    </View>
                </View>
            </View>

            {altEditing && editingAttachment && (
                <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                    <AltTextEditor
                        uri={editingAttachment.uri}
                        width={editingAttachment.width}
                        height={editingAttachment.height}
                        value={altEditing.draft}
                        onChange={draft => setAltEditing({ ...altEditing, draft })}
                        maxLength={instanceConfiguration.descriptionLimit}
                        focus={altEditing.focus}
                        onFocusChange={focus => setAltEditing({ ...altEditing, focus })}
                    />
                </ScrollView>
            )}

            {/* Hidden, not unmounted, while describing an image, so the post keeps its scroll and cursor */}
            <ScrollView
                style={[styles.scroll, altEditing && styles.hidden]}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
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
                                    accessibilityLabel={t('compose.visibilityLabel', { value: selectedVisibility.label })}
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
                                    accessibilityLabel={t('compose.languageLabel', { value: selectedLanguage.label })}
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
                            placeholder={t('compose.cwPlaceholder')}
                            accessibilityLabel={t('compose.cwLabel')}
                            accessibilityHint={t('compose.cwHint')}
                            // Only mounted once the tool is turned on, so this focuses it right away
                            autoFocus
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
                    placeholder={reply ? t('compose.replyPlaceholder') : t('compose.placeholder')}
                    accessibilityLabel={t('compose.textLabel')}
                    placeholderTextColor={colors.textMuted}
                    multiline
                    value={text}
                    onChangeText={setText}
                    onSelectionChange={event => {
                        cursor.current = event.nativeEvent.selection.end;
                    }}
                />

                <AttachmentStrip
                    attachments={media.attachments}
                    onDescribe={describeImage}
                    onEdit={editImage}
                    onRemove={media.remove}
                    onRetry={media.retry}
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
                style={[styles.toolbar, { paddingBottom: keyboard.visible ? 10 : Math.max(insets.bottom, 10) }, altEditing && styles.hidden]}
            >
                {/* A post has either images or a poll */}
                {tool('image-outline', t('compose.addMedia'), addFromLibrary, false, showPoll || media.room === 0)}
                {tool('camera-outline', t('compose.takePhoto'), addFromCamera, false, showPoll || media.room === 0)}
                {tool(showPoll ? 'stats-chart' : 'stats-chart-outline', t('compose.poll'), () => (showPoll ? resetPoll() : setShowPoll(true)), showPoll, media.attachments.length > 0)}
                {tool('warning-outline', t('compose.contentWarning'), () => setSensitive(!sensitive), sensitive)}
                {tool('happy-outline', t('compose.customEmoji'), () => setPicker('emoji'))}
                <View style={styles.toolbarSpacer} />
                <CharacterCounter remaining={remaining} max={instanceConfiguration.maxCharacters} />
            </View>
        </Animated.View>
    );

    return (
        <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={closeCompose}>
            <View style={styles.root}>
                <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim, opacity: progress }]} />
                {/* The app draws edge to edge, so the window doesn't resize for the keyboard. On Android,
                    KeyboardAvoidingView measures against the app window, which ends above the navigation bar,
                    and left a gap that tall under the sheet once the keyboard closed; pad by the keyboard instead. */}
                {Platform.OS === 'ios' ? (
                    <KeyboardAvoidingView behavior="padding" style={styles.keyboardAvoider}>
                        {sheet}
                    </KeyboardAvoidingView>
                ) : (
                    <View style={[styles.keyboardAvoider, { paddingBottom: keyboard.inset }]}>{sheet}</View>
                )}
            </View>

            <OptionSheet
                visible={picker === 'visibility'}
                title={t('compose.whoCanSee')}
                options={visibilityOptions}
                value={visibility}
                onSelect={setVisibility}
                onClose={() => setPicker(null)}
            />
            <OptionSheet
                visible={picker === 'language'}
                title={t('compose.postLanguage')}
                options={LANGUAGE_OPTIONS}
                value={language}
                onSelect={setLanguage}
                onClose={() => setPicker(null)}
            />
            <EmojiPicker visible={picker === 'emoji'} onPick={insertEmoji} onClose={() => setPicker(null)} />
            <ImageEditor
                visible={!!imageEditing}
                image={imageEditing?.original ?? null}
                initialEdits={imageEditing?.edits}
                onCancel={() => setImageEditing(null)}
                onDone={finishEditing}
            />
            <AltReminderSheet
                visible={reminderOpen}
                count={media.missingDescription.length}
                onDescribe={() => {
                    setReminderOpen(false);
                    const first = media.missingDescription[0];
                    if (first) describeImage(first.key);
                }}
                onPostAnyway={() => {
                    setReminderOpen(false);
                    handlePublish(true);
                }}
                onClose={() => setReminderOpen(false)}
            />
        </Modal>
    );
};

export default ComposeModal;
