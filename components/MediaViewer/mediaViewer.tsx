import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../ui/icon';
import { useVideoPlayer, VideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import { Image } from 'expo-image';
import { openLink } from '../../services/links';
import { ImageGallery } from './imageGallery';
import { SaveMediaButton } from './saveMediaButton';
import { DialogHost } from '../Dialog/dialogHost';
import { Attachment } from '../../services/mastodon/types';
import { styles } from './styles';
import { mediaColors } from '../../services/theme/media';
import { useI18n } from '../../services/i18n/i18nContext';
import { useTheme } from '../../services/themeContext';
import { formatDuration } from '../TootCard/focusedImage';

interface MediaViewerContextType {
    // With onOpenPost (e.g. from a profile's media grid), the viewer also offers to open the post
    // postUrl: the post on its own server, where media our server didn't keep can still be seen
    openMedia: (attachments: Attachment[], index: number, onOpenPost?: () => void, postUrl?: string) => void;
}

const MediaViewerContext = createContext<MediaViewerContextType | undefined>(undefined);

// Audio plays in the same player: ExoPlayer and AVPlayer take audio-only files
const isPlayable = (attachment: Attachment) => attachment.type === 'video' || attachment.type === 'gifv' || attachment.type === 'audio';

type OpenMedia = (
    | { kind: 'images'; images: Attachment[]; index: number }
    | { kind: 'video'; attachment: Attachment }
) & { onOpenPost?: () => void };

// "View post", across from the close button: closes the viewer and opens the post the media is from
const OpenPostButton = ({ onPress }: { onPress: () => void }) => {
    const insets = useSafeAreaInsets();
    const { t } = useI18n();
    const { type } = useTheme();
    return (
        <TouchableOpacity onPress={onPress} style={[styles.openPostButton, { top: insets.top + 12 }]} accessibilityRole="button" accessibilityLabel={t('media.viewPost')}>
            <Icon name="chatbox-outline" size={18} color={mediaColors.ink} />
            <Text style={[type.name, { color: mediaColors.ink }]}>{t('media.viewPost')}</Text>
        </TouchableOpacity>
    );
};

// Audio has no picture to tap for the native controls (which hide while playing on Android), so it gets
// its own, always on screen: progress (tap to seek), time, back / play-pause / forward, each with a label
const AudioControls = ({ player, duration }: { player: VideoPlayer; duration?: number }) => {
    const { t } = useI18n();
    const { type } = useTheme();
    const [trackWidth, setTrackWidth] = useState(0);
    const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing, oldIsPlaying: undefined });
    const { currentTime } = useEvent(player, 'timeUpdate', { currentTime: 0, currentLiveTimestamp: null, currentOffsetFromLive: null, bufferedPosition: 0 });
    const total = player.duration || duration || 0;
    const progress = total ? Math.min(currentTime / total, 1) : 0;
    const toggle = () => {
        if (isPlaying) player.pause();
        else if (total && currentTime >= total - 0.5) player.replay();
        else player.play();
    };
    const button = (icon: 'back-15' | 'forward-15' | 'play' | 'pause', label: string, onPress: () => void, big = false) => (
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.audioButton} hitSlop={8}>
            <View style={[styles.audioIcon, big && styles.audioIconBig]}>
                <Icon name={icon} size={big ? 30 : 24} color={big ? mediaColors.backdrop : mediaColors.ink} />
            </View>
            <Text style={[type.meta, { color: mediaColors.ink }]}>{label}</Text>
        </Pressable>
    );

    return (
        <View style={styles.audioControls} testID="audio-controls">
            <Pressable
                onLayout={event => setTrackWidth(event.nativeEvent.layout.width)}
                onPress={event => total && trackWidth && (player.currentTime = (event.nativeEvent.locationX / trackWidth) * total)}
                style={styles.audioTrackHit}
                accessible={false}
            >
                <View style={styles.audioTrack}>
                    <View style={styles.audioTrackBase} />
                    <View style={[styles.audioTrackFill, { width: `${progress * 100}%` }]} />
                </View>
            </Pressable>
            <Text style={[type.meta, styles.audioTime]}>
                {formatDuration(currentTime)} / {formatDuration(total)}
            </Text>
            <View style={styles.audioButtons}>
                {button('back-15', t('media.back15'), () => player.seekBy(-15))}
                {button(isPlaying ? 'pause' : 'play', t(isPlaying ? 'media.pause' : 'media.play'), toggle, true)}
                {button('forward-15', t('media.forward15'), () => player.seekBy(15))}
            </View>
        </View>
    );
};

// Mounted only while a video is open, so a player exists only for the video being watched
const VideoModal = ({ attachment, onClose, onOpenPost }: { attachment: Attachment; onClose: () => void; onOpenPost?: () => void }) => {
    const insets = useSafeAreaInsets();
    const { t } = useI18n();
    const audio = attachment.type === 'audio';
    const player = useVideoPlayer(attachment.url, player => {
        // gifv attachments are silent looping GIFs converted to video
        player.loop = attachment.type === 'gifv';
        // Android starts with this off, whatever the docs say, so the speed menu shifted the pitch
        player.preservesPitch = true;
        // Audio draws its own progress from these
        if (attachment.type === 'audio') player.timeUpdateEventInterval = 0.25;
        player.play();
    });

    return (
        <Modal visible onRequestClose={onClose} animationType="fade">
            <View style={styles.videoContainer}>
                {audio ? (
                    // No picture: its cover art (when it has one) above the player's controls
                    <>
                        <View style={styles.audioCover}>
                            {attachment.preview_url ? (
                                <Image source={{ uri: attachment.preview_url }} style={styles.audioCoverImage} contentFit="contain" accessibilityLabel={attachment.description || undefined} />
                            ) : (
                                <Icon name="volume-high-outline" size={72} color={mediaColors.ink} />
                            )}
                        </View>
                        <View style={{ marginBottom: insets.bottom + 16 }}>
                            <AudioControls player={player} duration={attachment.meta?.original?.duration} />
                        </View>
                    </>
                ) : (
                    <VideoView
                        player={player}
                        style={styles.video}
                        fullscreenOptions={{ enable: true }}
                        allowsPictureInPicture
                        contentFit="contain"
                        accessibilityLabel={attachment.description || undefined}
                    />
                )}
                <TouchableOpacity
                    onPress={onClose}
                    style={[styles.closeButton, { top: insets.top + 12 }]}
                    accessibilityLabel={t(audio ? 'media.close' : 'media.closeVideo')}
                >
                    <Icon name="close" size={30} color={mediaColors.ink} />
                </TouchableOpacity>
                {/* Left of the close button (38 wide, 20 from the edge); the photo library takes no audio */}
                {!audio && <SaveMediaButton url={attachment.url} style={{ top: insets.top + 12, right: 66 }} />}
                {onOpenPost && <OpenPostButton onPress={onOpenPost} />}
            </View>
            {/* Toasts and dialogs from Save draw over the video, not behind its modal */}
            <DialogHost />
        </Modal>
    );
};

// One media viewer for the whole app, instead of a player, image viewer and modal inside every card
export const MediaViewerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [open, setOpen] = useState<OpenMedia | null>(null);

    const openMedia = useCallback((attachments: Attachment[], index: number, onOpenPost?: () => void, postUrl?: string) => {
        const selected = attachments[index];
        if (!selected) {
            return;
        }
        if (isPlayable(selected)) {
            setOpen({ kind: 'video', attachment: selected, onOpenPost });
        } else if (selected.type === 'image') {
            // Only images go into the gallery, so swiping never lands on a video URL
            const images = attachments.filter(attachment => attachment.type === 'image');
            setOpen({ kind: 'images', images, index: images.indexOf(selected), onOpenPost });
        } else {
            // Media our server didn't keep: its own copy is a dead link (or a proxy that 404s), so show the
            // post where it lives, or else the original file, as Mastodon's web app links it
            openLink(postUrl ?? selected.remote_url ?? selected.url);
        }
    }, []);

    const close = useCallback(() => setOpen(null), []);
    const openPost = open?.onOpenPost
        ? () => {
              close();
              open.onOpenPost?.();
          }
        : undefined;
    const value = useMemo(() => ({ openMedia }), [openMedia]);

    return (
        <MediaViewerContext.Provider value={value}>
            {children}
            <ImageGallery
                images={open?.kind === 'images' ? open.images.map(image => ({ uri: image.url, description: image.description })) : []}
                index={open?.kind === 'images' ? open.index : 0}
                visible={open?.kind === 'images'}
                onClose={close}
                extraButton={openPost && <OpenPostButton onPress={openPost} />}
            />
            {open?.kind === 'video' && <VideoModal attachment={open.attachment} onClose={close} onOpenPost={openPost} />}
        </MediaViewerContext.Provider>
    );
};

// For what can also show outside the app's screens
export const useOptionalMediaViewer = () => useContext(MediaViewerContext);

export const useMediaViewer = () => {
    const context = useContext(MediaViewerContext);
    if (!context) {
        throw new Error('useMediaViewer must be used within a MediaViewerProvider');
    }
    return context;
};
