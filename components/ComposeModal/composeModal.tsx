import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Animated,
    DeviceEventEmitter,
    KeyboardAvoidingView,
    Modal,
    Dimensions,
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
import { createStatus, editStatus, getStatusSource } from '../../services/mastodon/statuses';
import { plainText } from '../../services/htmlText';
import { STATUS_UPDATED_EVENT, useUpdateCachedStatus } from '../../hooks/useUpdateCachedStatus';
import type { ExistingPost } from '../../services/composeContext';
import { ScheduleSheet, formatScheduleTime } from './scheduleSheet';
import { Suggestion, SuggestionRow } from './suggestionRow';
import { completeToken, tokenAtCursor } from './autocomplete';
import { search } from '../../services/mastodon/search';
import { useDebounced } from '../../hooks/useSearch';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { searchEmojis } from './emojiPicker';
import { useCustomEmojis } from '../../hooks/useCustomEmojis';
import { canSchedule } from '../../services/mastodon/scheduledStatuses';
import type { SharedContent } from '../../services/sharedContent';
import { Draft, DraftMedia, deleteDraft, draftsQueryKey, saveDraft } from '../../services/drafts';
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
import { ActionSheet, OptionSheet, SheetOption } from './optionSheet';
import { DEFAULT_POLL_DURATION, PollEditor } from './pollEditor';
import { useKeyboard } from '../../hooks/useKeyboard';
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
import { QuotedPost } from '../TootCard/quotedPost';
import { effectiveQuotePolicy, QuotePolicy, quotePolicies } from '../../services/mastodon/quotes';
import { useI18n } from '../../services/i18n/i18nContext';
import { Translator } from '../../services/i18n/translate';
import { DialogHost } from '../Dialog/dialogHost';
import { dialog } from '../../services/dialog';

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

// The account's default posting language (Akkoma and Pleroma have none), else the app's, else English.
// A regional code like pt-BR counts as its language.
export const defaultLanguage = (user: Account | null, appLanguage?: string) =>
    [user?.source?.language, appLanguage]
        .map(code => code?.split('-')[0])
        .find(code => code && LANGUAGES.some(l => l.code === code)) ?? 'en';

// Replies keep the parent's visibility; new posts use the account's default. Quoting a followers-only
// post makes the quote followers-only too (Mastodon enforces it).
export const defaultVisibility = (user: Account | null, replyToStatus: Status | null, quoteStatus: Status | null = null): Visibility => {
    const visibility = replyToStatus?.visibility ?? user?.source?.privacy ?? 'public';
    return quoteStatus?.visibility === 'private' && (visibility === 'public' || visibility === 'unlisted') ? 'private' : visibility;
};



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

// Anything typed beyond the reply mentions the sheet opened with, a poll, a content warning or images
export const hasDraft = ({ text, initialText, showPoll, spoilerText, hasMedia = false }: { text: string; initialText: string; showPoll: boolean; spoilerText: string; hasMedia?: boolean }) =>
    text.trim() !== initialText.trim() || showPoll || spoilerText.trim().length > 0 || hasMedia;

interface ComposeModalProps {
    isOpen: boolean;
    replyToStatus: Status | null;
    // The post being quoted, shown under the text
    quoteStatus?: Status | null;
    // One of your posts to edit, or to redraft after deleting it
    existingPost?: ExistingPost | null;
    // Text and media another app shared with pugdon
    shared?: SharedContent | null;
    // Shared while already open (a keyboard's GIF), added to the draft
    incoming?: SharedContent | null;
    // A draft put aside on this phone, reopened
    draft?: Draft | null;
    closeCompose: () => void;
}

// What an edit sends back for a poll it can't change: the same choices and the time it has left
// (leaving the poll out would remove it; new choices would reset its votes)
const unchangedPoll = (poll: NonNullable<Status['poll']>) => ({
    options: poll.options.map(option => option.title),
    multiple: poll.multiple,
    expires_in: Math.max(300, Math.round(((poll.expires_at ? new Date(poll.expires_at).getTime() : Date.now()) - Date.now()) / 1000)),
});

const WOOF_CHANCE = 0.1;

const ComposeModal: React.FC<ComposeModalProps> = ({ isOpen, replyToStatus, quoteStatus = null, existingPost = null, shared = null, incoming = null, draft = null, closeCompose }) => {
    const { user } = useAuth();
    const { colors, type } = useTheme();
    const i18n = useI18n();
    const { t, locale, language: appLanguage } = i18n;
    const styles = useThemedStyles(makeStyles);
    const insets = useSafeAreaInsets();
    // Now and then the post button barks; rolled once per opening so it doesn't flicker
    const woof = useMemo(() => isOpen && Math.random() < WOOF_CHANCE, [isOpen]);
    const { height: windowHeight } = useWindowDimensions();
    // Compose covers the whole screen, navigation bar included, so the keyboard is measured against the screen.
    // On Android the window can end above a 3-button navigation bar: measured against it, the toolbar sat under the keyboard.
    const keyboard = useKeyboard(Platform.OS === 'android' ? Dimensions.get('screen').height : windowHeight);
    // The modal is always mounted, so only load the instance limits while composing
    const instanceConfiguration = useInstanceConfiguration(isOpen && !!user);

    const [text, setText] = useState('');
    const [sensitive, setSensitive] = useState(false);
    const [spoilerText, setSpoilerText] = useState('');
    const [loading, setLoading] = useState(false);
    const [language, setLanguage] = useState(() => defaultLanguage(user, appLanguage));
    const [visibility, setVisibility] = useState<Visibility>(() => defaultVisibility(user, replyToStatus, quoteStatus));
    const [picker, setPicker] = useState<'language' | 'visibility' | 'emoji' | 'quotePolicy' | 'camera' | 'schedule' | null>(null);
    // Publish later: the server posts it then (not for edits)
    const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
    // The post being quoted (✕ drops it) and who may quote this one
    const [quote, setQuote] = useState<Status | null>(quoteStatus);
    const [quotePolicy, setQuotePolicy] = useState<QuotePolicy>(user?.source?.quote_policy ?? 'public');

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
    // The cursor as state too, so the emoji suggestions follow it while typing
    const [caret, setCaret] = useState(0);
    const { data: customEmojis } = useCustomEmojis(isOpen);
    // A ":shortcode" or "@mention" being typed, to suggest how to finish it
    const token = tokenAtCursor(text, caret);
    const emojiMatches = useMemo(
        () => (token?.trigger === ':' ? searchEmojis((customEmojis ?? []).filter(emoji => emoji.visible_in_picker), token.query) : []),
        [customEmojis, token?.trigger, token?.query]
    );
    // People, once typing pauses; the server only looks up unknown accounts for a full @user@server
    const mentionQuery = useDebounced(token?.trigger === '@' ? token.query : '', 250);
    const { data: mentionMatches } = useQuery({
        queryKey: ['mentionSuggestions', mentionQuery],
        queryFn: async () => (await search({ q: mentionQuery, type: 'accounts', limit: 8, resolve: mentionQuery.includes('@') })).accounts,
        enabled: isOpen && mentionQuery.length > 0,
        staleTime: 60_000,
    });

    // The keyboard comes up once the sheet is in place: Android shows none for a focus before its window is
    // ready, and React Native then skips later focus calls, thinking the field already has it
    const { mounted, progress } = useSheetTransition(isOpen, () => inputRef.current?.focus());
    // The text the sheet opened with (reply mentions), to tell whether there's a draft to lose
    const initialText = useRef('');
    // closeCompose clears the reply right away; keep showing it while the sheet slides out
    const shownReply = useRef(replyToStatus);
    if (isOpen) shownReply.current = replyToStatus;
    const reply = shownReply.current;
    const shownExisting = useRef(existingPost);
    if (isOpen) shownExisting.current = existingPost;
    const existing = shownExisting.current;
    const editing = existing?.mode === 'edit';
    // An edit keeps the post's poll as it is
    const lockedPoll = editing ? existing.status.poll ?? null : null;
    const updateCachedStatus = useUpdateCachedStatus();

    const queryClient = useQueryClient();

    // Puts the post aside on this phone (a reopened draft is replaced), then closes
    const saveAsDraft = async () => {
        if (!user) return;
        try {
            await saveDraft(
                user.id,
                {
                    text,
                    spoilerText,
                    sensitive,
                    visibility,
                    language,
                    quotePolicy,
                    scheduledAt: scheduledAt?.toISOString() ?? null,
                    poll: showPoll ? { options: pollOptions, duration: pollDuration, multiple: pollMultiple } : null,
                    replyTo: reply,
                    quote,
                    media: media.attachments.map((attachment): DraftMedia => {
                        const picked = media.pickedFor(attachment.key);
                        return picked
                            ? { image: picked, description: attachment.description, focus: attachment.focus }
                            : { existing: attachment, description: attachment.description, focus: attachment.focus };
                    }),
                },
                draft?.id
            );
            queryClient.invalidateQueries({ queryKey: draftsQueryKey(user.id) });
            dialog.toast(t('compose.draftSaved'));
            closeCompose();
        } catch (error) {
            console.warn('Saving the draft failed:', error);
            dialog.alert(t('compose.draftSaveFailed'), t('compose.draftSaveFailedMessage'));
        }
    };

    // Cancel and swiping the sheet down close it, asking first if there's something to lose: a reopened
    // draft always asks, so it can be saved again. Edits of a published post can't become drafts.
    const requestClose = (cancel = () => {}) => {
        if (!draft && !hasDraft({ text, initialText: initialText.current, showPoll, spoilerText, hasMedia: media.attachments.length > 0 })) {
            closeCompose();
            return;
        }
        if (editing) {
            dialog.alert(t('compose.discardTitle'), t('compose.discardMessage'), [
                { text: t('compose.keepEditing'), style: 'cancel', onPress: cancel },
                { text: t('compose.discard'), style: 'destructive', onPress: closeCompose },
            ], { cancelable: true, onDismiss: cancel });
            return;
        }
        dialog.alert(t('compose.draftTitle'), t('compose.draftMessage'), [
            { text: t('compose.keepEditing'), style: 'cancel', onPress: cancel },
            { text: t('compose.discard'), style: 'destructive', onPress: closeCompose },
            { text: t('compose.saveDraft'), onPress: () => void saveAsDraft() },
        ], { cancelable: true, onDismiss: cancel });
    };
    const { drag, panHandlers } = useDragToDismiss(requestClose);

    // Adds what was picked, shot or shared, saying when a video had to be left out. Declared before the
    // effect below: compose renders nothing until mounted, so a later declaration isn't there yet when it runs
    const addPicked = (picked: Parameters<typeof media.add>[0]) => {
        const { videoNotAlone, videoTooBig } = media.add(picked);
        if (videoTooBig) {
            dialog.toast(t('compose.videoTooBig', { size: Math.round(instanceConfiguration.videoSizeLimit / (1024 * 1024)) }));
        } else if (videoNotAlone) {
            dialog.toast(t('compose.videoNotAlone'));
        }
    };

    useEffect(() => {
        if (isOpen) {
            const startText = replyToStatus ? replyMentionsText(replyToStatus, user) : '';
            initialText.current = startText;
            drag.setValue(0);
            // Something shared from another app counts as a draft, so closing asks first
            const withShared = shared?.text ? `${startText}${shared.text}` : startText;
            setText(withShared);
            cursor.current = withShared.length;
            setSensitive(false);
            setSpoilerText('');
            setLanguage(defaultLanguage(user, appLanguage));
            setVisibility(defaultVisibility(user, replyToStatus, quoteStatus));
            setQuote(quoteStatus);
            setQuotePolicy(user?.source?.quote_policy ?? 'public');
            setLoading(false);
            setShowPoll(false);
            setPollOptions(['', '']);
            setPollDuration(DEFAULT_POLL_DURATION);
            setPollMultiple(false);
            setPicker(null);
            setScheduledAt(null);
            media.reset();
            if (shared?.media.length) addPicked(shared.media);
            setAltEditing(null);
            setImageEditing(null);
            setReminderOpen(false);
            reminded.current = false;

            // Your post, back in compose: its words, warning, language, quote, images and poll
            let current = true;
            if (existingPost) {
                const post = existingPost.status;
                const source = existingPost.mode === 'redraft' ? post.text ?? plainText(post.content) : plainText(post.content);
                initialText.current = source;
                setText(source);
                cursor.current = source.length;
                setSensitive(!!post.spoiler_text);
                setSpoilerText(post.spoiler_text ?? '');
                setVisibility(post.visibility);
                if (post.language && LANGUAGES.some(option => option.code === post.language)) setLanguage(post.language);
                setQuote(post.quote?.quoted_status ?? null);
                if (post.poll && existingPost.mode === 'redraft') {
                    setShowPoll(true);
                    setPollOptions(post.poll.options.map(option => option.title));
                    setPollMultiple(post.poll.multiple);
                }
                media.addExisting(post.media_attachments ?? []);
                // The rendered post loses some of what was typed; edits start from the source
                if (existingPost.mode === 'edit') {
                    getStatusSource(post.id)
                        .then(written => {
                            // Keep the rendered text if the source doesn't come back as expected
                            if (!current || typeof written?.text !== 'string') return;
                            initialText.current = written.text;
                            setText(written.text);
                            cursor.current = written.text.length;
                            setSensitive(!!written.spoiler_text);
                            setSpoilerText(written.spoiler_text ?? '');
                        })
                        .catch(error => console.warn('Could not load the post source:', error));
                }
            }

            // A draft put aside earlier, as it was left
            if (draft) {
                initialText.current = draft.text;
                setText(draft.text);
                cursor.current = draft.text.length;
                setSensitive(draft.sensitive);
                setSpoilerText(draft.spoilerText);
                setVisibility(draft.visibility);
                setLanguage(draft.language);
                setQuotePolicy(draft.quotePolicy);
                setScheduledAt(draft.scheduledAt ? new Date(draft.scheduledAt) : null);
                if (draft.poll) {
                    setShowPoll(true);
                    setPollOptions(draft.poll.options);
                    setPollDuration(draft.poll.duration);
                    setPollMultiple(draft.poll.multiple);
                }
                const picked = draft.media.flatMap(item => (item.image ? [{ ...item.image, description: item.description, focus: item.focus }] : []));
                if (picked.length) addPicked(picked);
                media.addReady(draft.media.flatMap(item => (item.existing ? [{ ...item.existing, description: item.description, focus: item.focus }] : [])));
            }

            return () => {
                current = false;
            };
        }
    }, [isOpen, replyToStatus, quoteStatus, existingPost, shared, draft, drag]);

    // What arrives while composing joins the draft: its media, its words at the cursor
    useEffect(() => {
        if (!incoming) return;
        if (incoming.media.length) addPicked(incoming.media);
        if (incoming.text) {
            const next = insertAt(text, cursor.current, incoming.text);
            setText(next.text);
            cursor.current = next.cursor;
        }
    }, [incoming]);

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
    // Followers-only and private posts can't be quoted by others, whatever the setting says
    const quotePolicyOptions = quotePolicies(i18n);
    const shownQuotePolicy = effectiveQuotePolicy(quotePolicy, visibility);
    const quotePolicyLocked = shownQuotePolicy !== quotePolicy || visibility === 'private' || visibility === 'direct';
    const selectedQuotePolicy = quotePolicyOptions.find(option => option.value === shownQuotePolicy) ?? quotePolicyOptions[0];

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

    // A suggestion tapped: the half-typed ":neofox_som" or "@an" becomes the full one plus a space, cursor after it
    const complete = (replacement: string) => {
        if (!token) return;
        const next = completeToken(text, token.start, caret, replacement);
        setText(next.text);
        cursor.current = next.cursor;
        setCaret(next.cursor);
        requestAnimationFrame(() => inputRef.current?.setSelection?.(next.cursor, next.cursor));
    };
    const suggestions: Suggestion[] =
        token?.trigger === ':'
            ? emojiMatches.map(emoji => ({
                  key: emoji.shortcode,
                  image: emoji.static_url || emoji.url,
                  title: `:${emoji.shortcode}:`,
                  onPick: () => complete(`:${emoji.shortcode}:`),
              }))
            : token?.trigger === '@'
              ? (mentionMatches ?? []).map(account => ({
                    key: account.id,
                    image: account.avatar,
                    person: true,
                    title: account.display_name || account.username,
                    subtitle: `@${account.acct}`,
                    onPick: () => complete(`@${account.acct}`),
                }))
              : [];

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
            dialog.alert(t('editor.failedTitle'), t('editor.failed'));
        }
    };

    const addFromLibrary = async () => {
        try {
            addPicked(await pickImages(media.room, media.canAddVideo));
        } catch (error) {
            console.warn('Could not open the gallery:', error);
        }
    };

    const capture = async (video: boolean) => {
        try {
            const shot = await takePhoto(video);
            if (shot === 'denied') {
                dialog.alert(t('compose.cameraDeniedTitle'), t('compose.cameraDenied'));
                return;
            }
            addPicked(shot);
        } catch (error) {
            console.warn('Could not open the camera:', error);
        }
    };

    // Always asks photo or video; once the post has media, video is shown but greyed out with the reason
    const addFromCamera = () => setPicker('camera');
    // iOS can't open the camera while the sheet is still closing
    const captureAfterSheet = (video: boolean) => setTimeout(() => capture(video), Platform.OS === 'ios' ? 400 : 0);

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
            if (editing && existing) {
                const { ids, attributes } = media.editAttributes();
                const updated = await editStatus(existing.status.id, {
                    status: text,
                    spoiler_text: sensitive ? spoilerText : '',
                    sensitive,
                    language,
                    media_ids: ids,
                    media_attributes: attributes.length > 0 ? attributes : undefined,
                    poll: lockedPoll ? unchangedPoll(lockedPoll) : undefined,
                    quote_approval_policy: instanceConfiguration.supportsQuotes ? shownQuotePolicy : undefined,
                });
                updateCachedStatus(updated);
                DeviceEventEmitter.emit(STATUS_UPDATED_EVENT, updated);
                closeCompose();
                return;
            }
            // Too late by the time Post was tapped: ask for a new time rather than post now
            if (scheduledAt && !canSchedule(scheduledAt)) {
                dialog.alert(t('schedule.tooSoonTitle'), t('schedule.tooSoon'));
                setPicker('schedule');
                return;
            }
            const mediaIds = await media.finish();
            await createStatus({
                status: text,
                in_reply_to_id: reply ? reply.id : existing?.status.in_reply_to_id ?? null,
                sensitive,
                spoiler_text: sensitive ? spoilerText : undefined,
                language: language,
                visibility,
                poll: pollParams,
                media_ids: mediaIds.length > 0 ? mediaIds : undefined,
                quoted_status_id: quote?.id,
                quote_approval_policy: instanceConfiguration.supportsQuotes ? shownQuotePolicy : undefined,
                scheduled_at: scheduledAt?.toISOString(),
            });

            if (scheduledAt) {
                dialog.toast(t('schedule.scheduledToast', { when: formatScheduleTime(scheduledAt, locale) }));
            } else {
                DeviceEventEmitter.emit('status_published');
            }
            if (draft && user) {
                deleteDraft(user.id, draft.id)
                    .then(() => queryClient.invalidateQueries({ queryKey: draftsQueryKey(user.id) }))
                    .catch(error => console.warn('Removing the posted draft failed:', error));
            }
            closeCompose();
        } catch (error: any) {
            console.error('Failed to post status:', error);
            dialog.alert(
                editing ? t('compose.saveFailed') : t('compose.publishFailed'),
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

    const submitLabel = editing ? t('compose.save') : scheduledAt ? t('schedule.confirm') : t('compose.post');

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
                    <PillButton
                        label={t('common.cancel')}
                        variant="subtle"
                        onPress={altEditing ? () => setAltEditing(null) : () => requestClose()}
                    />
                    <Text
                        accessibilityRole="header"
                        style={[type.sheetTitle, styles.headerTitle]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.8}
                    >
                        {altEditing
                            ? t('compose.describeTitle')
                            : editing
                              ? t('compose.editPost')
                              : reply
                                ? t('compose.reply')
                                : quote
                                  ? t('compose.quotePost')
                                  : t('compose.newPost')}
                    </Text>
                    {altEditing ? (
                        <PillButton label={t('compose.done')} onPress={saveDescription} disabled={altOverLimit} />
                    ) : (
                        <PillButton
                            label={woof && !editing && !scheduledAt ? t('compose.postWoof') : submitLabel}
                            accessibilityLabel={submitLabel}
                            onPress={() => handlePublish()}
                            disabled={isPublishDisabled && !loading}
                            loading={loading}
                        />
                    )}
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
                        video={editingAttachment.isVideo}
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
                                {/* Visibility can't change once posted */}
                                <Pressable
                                    onPress={() => setPicker('visibility')}
                                    disabled={editing}
                                    accessibilityRole="button"
                                    accessibilityLabel={t('compose.visibilityLabel', { value: selectedVisibility.label })}
                                    accessibilityHint={editing ? t('compose.visibilityLocked') : undefined}
                                    accessibilityState={{ disabled: editing }}
                                    hitSlop={hitSlopFor(0, PILL_HEIGHT)}
                                    style={({ pressed }) => [styles.pill, (pressed || editing) && { opacity: 0.7 }]}
                                >
                                    <Ionicons name={selectedVisibility.icon} size={14} color={colors.accentText} />
                                    <Text style={[type.name, styles.pillText]}>{selectedVisibility.label}</Text>
                                    {!editing && <Ionicons name="chevron-down" size={12} color={colors.textSecondary} />}
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
                                {instanceConfiguration.supportsQuotes && (
                                    <Pressable
                                        onPress={() => setPicker('quotePolicy')}
                                        disabled={quotePolicyLocked}
                                        accessibilityRole="button"
                                        accessibilityLabel={t('compose.quotePolicyLabel', { value: selectedQuotePolicy.label })}
                                        accessibilityState={{ disabled: quotePolicyLocked }}
                                        hitSlop={hitSlopFor(0, PILL_HEIGHT)}
                                        style={({ pressed }) => [styles.pill, (pressed || quotePolicyLocked) && { opacity: 0.7 }]}
                                    >
                                        <Ionicons name="chatbox-ellipses-outline" size={14} color={colors.accentText} />
                                        <Text style={[type.name, styles.pillText]}>{selectedQuotePolicy.label}</Text>
                                        {!quotePolicyLocked && <Ionicons name="chevron-down" size={12} color={colors.textSecondary} />}
                                    </Pressable>
                                )}
                            </View>
                        </View>
                    </View>
                )}

                {quote?.visibility === 'private' && (
                    <Text style={[type.meta, styles.quoteNote]}>{t('compose.quotePrivateNote')}</Text>
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
                        setCaret(event.nativeEvent.selection.end);
                    }}
                />

                {quote && (
                    <View style={styles.quote}>
                        <QuotedPost quote={{ state: 'accepted', quoted_status: quote }} />
                        {/* An edit can't drop or change the quote */}
                        {!editing && <IconButton
                            icon="close-circle"
                            size={22}
                            color={colors.textMuted}
                            accessibilityLabel={t('compose.removeQuote')}
                            onPress={() => setQuote(null)}
                            style={styles.quoteRemove}
                        />}
                    </View>
                )}

                {lockedPoll && (
                    <Well style={styles.lockedPoll}>
                        <Text style={[type.label, styles.lockedPollTitle]}>{t('pollEditor.title')}</Text>
                        {lockedPoll.options.map((option, index) => (
                            <Text key={index} style={[type.body, styles.lockedPollOption]}>· {option.title}</Text>
                        ))}
                        <Text style={[type.meta, styles.lockedPollNote]}>{t('compose.pollLocked')}</Text>
                    </Well>
                )}

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

            {!altEditing && (
                <SuggestionRow label={t(token?.trigger === '@' ? 'compose.mentionSuggestions' : 'compose.emojiSuggestions')} suggestions={suggestions} />
            )}

            {/* When it will go out, in words, with a way to post now instead */}
            {scheduledAt && !altEditing && (
                <View style={[styles.scheduledRow, { borderTopColor: colors.borderColor }]}>
                    <Pressable
                        onPress={() => setPicker('schedule')}
                        accessibilityRole="button"
                        accessibilityLabel={t('schedule.scheduledFor', { when: formatScheduleTime(scheduledAt, locale) })}
                        style={[styles.scheduledChip, { backgroundColor: colors.accentSoft }]}
                    >
                        <Ionicons name="calendar" size={14} color={colors.accentText} />
                        <Text style={[type.label, { color: colors.accentText }]} numberOfLines={1}>
                            {t('schedule.scheduledFor', { when: formatScheduleTime(scheduledAt, locale) })}
                        </Text>
                    </Pressable>
                    <IconButton icon="close" accessibilityLabel={t('schedule.clear')} onPress={() => setScheduledAt(null)} />
                </View>
            )}

            <View
                accessibilityRole="toolbar"
                style={[styles.toolbar, { paddingBottom: keyboard.visible ? 10 : Math.max(insets.bottom, 10) }, altEditing && styles.hidden]}
            >
                {/* A post has either images or a poll */}
                {tool('image-outline', t('compose.addMedia'), addFromLibrary, false, showPoll || !!lockedPoll || media.room === 0)}
                {tool('camera-outline', t('compose.camera'), addFromCamera, false, showPoll || !!lockedPoll || media.room === 0)}
                {tool(showPoll ? 'stats-chart' : 'stats-chart-outline', t('compose.poll'), () => (showPoll ? resetPoll() : setShowPoll(true)), showPoll, media.attachments.length > 0 || editing)}
                {tool('warning-outline', t('compose.contentWarning'), () => setSensitive(!sensitive), sensitive)}
                {tool('happy-outline', t('compose.customEmoji'), () => setPicker('emoji'))}
                {!editing && tool(scheduledAt ? 'calendar' : 'calendar-outline', t('schedule.title'), () => setPicker('schedule'), !!scheduledAt)}
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
                    <View testID="compose-keyboard-area" style={[styles.keyboardAvoider, { paddingBottom: keyboard.inset }]}>{sheet}</View>
                )}
            </View>

            <ScheduleSheet
                visible={picker === 'schedule'}
                value={scheduledAt}
                onSchedule={setScheduledAt}
                onClear={scheduledAt ? () => setScheduledAt(null) : undefined}
                onClose={() => setPicker(null)}
            />
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
            <OptionSheet
                visible={picker === 'quotePolicy'}
                title={t('compose.whoCanQuote')}
                options={quotePolicyOptions}
                value={quotePolicy}
                onSelect={setQuotePolicy}
                onClose={() => setPicker(null)}
            />
            <EmojiPicker visible={picker === 'emoji'} onPick={insertEmoji} onClose={() => setPicker(null)} />
            <ActionSheet
                visible={picker === 'camera'}
                title={t('compose.camera')}
                actions={[
                    { key: 'photo', label: t('compose.takePhoto'), icon: 'camera-outline', onPress: () => captureAfterSheet(false) },
                    {
                        key: 'video',
                        label: t('compose.recordVideo'),
                        icon: 'videocam-outline',
                        // Mastodon takes photos or one video, not both, so a video can only start an empty post
                        disabled: !media.canAddVideo,
                        description: media.canAddVideo ? undefined : t('compose.videoOnlyAlone'),
                        onPress: () => captureAfterSheet(true),
                    },
                ]}
                onClose={() => setPicker(null)}
            />
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
                video={media.missingDescription.some(attachment => attachment.isVideo)}
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
            <DialogHost active={isOpen} />
        </Modal>
    );
};

export default ComposeModal;
