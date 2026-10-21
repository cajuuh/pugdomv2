import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as WebBrowser from 'expo-web-browser';
import { ImageGallery } from './imageGallery';
import { SaveMediaButton } from './saveMediaButton';
import { DialogHost } from '../Dialog/dialogHost';
import { Attachment } from '../../services/mastodon/types';
import { styles } from './styles';
import { mediaColors } from '../../services/theme/media';
import { useI18n } from '../../services/i18n/i18nContext';
import { useTheme } from '../../services/themeContext';

interface MediaViewerContextType {
    // With onOpenPost (e.g. from a profile's media grid), the viewer also offers to open the post
    openMedia: (attachments: Attachment[], index: number, onOpenPost?: () => void) => void;
}

const MediaViewerContext = createContext<MediaViewerContextType | undefined>(undefined);

const isVideo = (attachment: Attachment) => attachment.type === 'video' || attachment.type === 'gifv';

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
            <Ionicons name="chatbox-outline" size={18} color={mediaColors.ink} />
            <Text style={[type.name, { color: mediaColors.ink }]}>{t('media.viewPost')}</Text>
        </TouchableOpacity>
    );
};

// Mounted only while a video is open, so a player exists only for the video being watched
const VideoModal = ({ attachment, onClose, onOpenPost }: { attachment: Attachment; onClose: () => void; onOpenPost?: () => void }) => {
    const insets = useSafeAreaInsets();
    const { t } = useI18n();
    const player = useVideoPlayer(attachment.url, player => {
        // gifv attachments are silent looping GIFs converted to video
        player.loop = attachment.type === 'gifv';
        player.play();
    });

    return (
        <Modal visible onRequestClose={onClose} animationType="fade">
            <View style={styles.videoContainer}>
                <VideoView
                    player={player}
                    style={styles.video}
                    fullscreenOptions={{ enable: true }}
                    allowsPictureInPicture
                    contentFit="contain"
                    accessibilityLabel={attachment.description || undefined}
                />
                <TouchableOpacity
                    onPress={onClose}
                    style={[styles.closeButton, { top: insets.top + 12 }]}
                    accessibilityLabel={t('media.closeVideo')}
                >
                    <Ionicons name="close" size={30} color={mediaColors.ink} />
                </TouchableOpacity>
                {/* Left of the close button (38 wide, 20 from the edge) */}
                <SaveMediaButton url={attachment.url} style={{ top: insets.top + 12, right: 66 }} />
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

    const openMedia = useCallback((attachments: Attachment[], index: number, onOpenPost?: () => void) => {
        const selected = attachments[index];
        if (!selected) {
            return;
        }
        if (isVideo(selected)) {
            setOpen({ kind: 'video', attachment: selected, onOpenPost });
        } else if (selected.type === 'image') {
            // Only images go into the gallery, so swiping never lands on a video URL
            const images = attachments.filter(attachment => attachment.type === 'image');
            setOpen({ kind: 'images', images, index: images.indexOf(selected), onOpenPost });
        } else {
            // Unknown media types can't be previewed in-app
            WebBrowser.openBrowserAsync(selected.url).catch(error => console.error('Failed to open media:', error));
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

export const useMediaViewer = () => {
    const context = useContext(MediaViewerContext);
    if (!context) {
        throw new Error('useMediaViewer must be used within a MediaViewerProvider');
    }
    return context;
};
