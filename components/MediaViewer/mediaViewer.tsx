import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Modal, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as WebBrowser from 'expo-web-browser';
import ImageViewing from 'react-native-image-viewing';
import { Attachment } from '../../services/mastodon/types';
import { styles } from './styles';
import { mediaColors } from '../../services/theme/media';
import { useI18n } from '../../services/i18n/i18nContext';

interface MediaViewerContextType {
    openMedia: (attachments: Attachment[], index: number) => void;
}

const MediaViewerContext = createContext<MediaViewerContextType | undefined>(undefined);

const isVideo = (attachment: Attachment) => attachment.type === 'video' || attachment.type === 'gifv';

type OpenMedia =
    | { kind: 'images'; images: Attachment[]; index: number }
    | { kind: 'video'; attachment: Attachment };

// Mounted only while a video is open, so a player exists only for the video being watched
const VideoModal = ({ attachment, onClose }: { attachment: Attachment; onClose: () => void }) => {
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
            </View>
        </Modal>
    );
};

// One media viewer for the whole app, instead of a player, image viewer and modal inside every card
export const MediaViewerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [open, setOpen] = useState<OpenMedia | null>(null);
    const { height } = useWindowDimensions();

    const openMedia = useCallback((attachments: Attachment[], index: number) => {
        const selected = attachments[index];
        if (!selected) {
            return;
        }
        if (isVideo(selected)) {
            setOpen({ kind: 'video', attachment: selected });
        } else if (selected.type === 'image') {
            // Only images go into the gallery, so swiping never lands on a video URL
            const images = attachments.filter(attachment => attachment.type === 'image');
            setOpen({ kind: 'images', images, index: images.indexOf(selected) });
        } else {
            // Unknown media types can't be previewed in-app
            WebBrowser.openBrowserAsync(selected.url).catch(error => console.error('Failed to open media:', error));
        }
    }, []);

    const close = useCallback(() => setOpen(null), []);
    const value = useMemo(() => ({ openMedia }), [openMedia]);

    const imageCount = open?.kind === 'images' ? open.images.length : 0;
    const ImageViewerFooter = ({ imageIndex }: { imageIndex: number }) => {
        if (imageCount <= 1) return null;
        return (
            <View style={{ height, width: '100%', position: 'absolute', bottom: 0 }} pointerEvents="box-none">
                {imageIndex > 0 && (
                    <View style={[styles.navButton, styles.navLeft]}>
                        <Ionicons name="chevron-back" size={24} color={mediaColors.ink} />
                    </View>
                )}
                {imageIndex < imageCount - 1 && (
                    <View style={[styles.navButton, styles.navRight]}>
                        <Ionicons name="chevron-forward" size={24} color={mediaColors.ink} />
                    </View>
                )}
            </View>
        );
    };

    return (
        <MediaViewerContext.Provider value={value}>
            {children}
            <ImageViewing
                images={open?.kind === 'images' ? open.images.map(image => ({ uri: image.url })) : []}
                imageIndex={open?.kind === 'images' ? open.index : 0}
                visible={open?.kind === 'images'}
                onRequestClose={close}
                swipeToCloseEnabled={true}
                doubleTapToZoomEnabled={true}
                backgroundColor={mediaColors.scrimStrong}
                FooterComponent={ImageViewerFooter}
            />
            {open?.kind === 'video' && <VideoModal attachment={open.attachment} onClose={close} />}
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
