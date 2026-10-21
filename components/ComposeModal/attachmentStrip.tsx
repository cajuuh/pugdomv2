import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../services/themeContext';
import { useI18n } from '../../services/i18n/i18nContext';
import { mediaColors } from '../../services/theme/media';
import { radii, space } from '../../services/theme/shape';
import { ComposeAttachment } from '../../hooks/useMediaAttachments';
import { useVideoPlayer, VideoView } from 'expo-video';

const THUMB_SIZE = 104;

const duration = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;

// The picked video's first frame, still and muted (one at most: a video goes alone in a post)
const VideoThumb = ({ uri }: { uri: string }) => {
    const player = useVideoPlayer(uri, player => {
        player.muted = true;
    });
    return (
        <>
            <VideoView player={player} style={styles.image} contentFit="cover" nativeControls={false} />
            {/* On Android the video view takes every touch for itself, so a plain view on top gets the tap for the button */}
            <View testID="video-touch-cover" style={StyleSheet.absoluteFill} />
        </>
    );
};

interface AttachmentStripProps {
    attachments: ComposeAttachment[];
    // Opens the description editor
    onDescribe: (key: string) => void;
    // Opens the image editor (not for GIFs, which editing would flatten, nor videos)
    onEdit: (key: string) => void;
    onRemove: (key: string) => void;
    onRetry: (key: string) => void;
}

// The images (or video) attached to a post: each shows its upload progress, an ALT badge once described,
// and buttons to edit or remove it, or retry a failed upload. Tapping one edits its description.
export const AttachmentStrip: React.FC<AttachmentStripProps> = ({ attachments, onDescribe, onEdit, onRemove, onRetry }) => {
    const { colors, type } = useTheme();
    const { t } = useI18n();
    if (attachments.length === 0) return null;

    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip} keyboardShouldPersistTaps="handled" testID="attachment-strip">
            {attachments.map((attachment, position) => {
                const index = position + 1;
                const described = attachment.description.trim().length > 0;
                // Labels say "video" for a video
                const label = (key: 'describe' | 'edit' | 'remove' | 'retry' | 'uploading') =>
                    t(attachment.isVideo ? (`attachments.${key}Video` as 'attachments.describeVideo') : `attachments.${key}`, { index });
                return (
                    <View key={attachment.key} style={[styles.thumb, { backgroundColor: colors.inputBackground }]}>
                        <Pressable
                            onPress={() => onDescribe(attachment.key)}
                            accessibilityRole="button"
                            accessibilityLabel={label('describe')}
                            accessibilityValue={described ? { text: attachment.description } : undefined}
                            style={StyleSheet.absoluteFill}
                        >
                            {attachment.isVideo && !attachment.existing ? (
                                <VideoThumb uri={attachment.uri} />
                            ) : (
                                <Image source={{ uri: attachment.uri }} style={styles.image} resizeMode="cover" />
                            )}
                        </Pressable>

                        {attachment.status === 'uploading' && (
                            <View
                                style={[styles.progressTrack, !attachment.isGif && !attachment.isVideo && !attachment.existing && styles.progressTrackBesideEdit, { backgroundColor: mediaColors.scrim }]}
                                accessible
                                accessibilityRole="progressbar"
                                accessibilityLabel={label('uploading')}
                                accessibilityValue={{ min: 0, max: 100, now: Math.round(attachment.progress * 100) }}
                            >
                                <View style={[styles.progressBar, { width: `${Math.round(attachment.progress * 100)}%`, backgroundColor: colors.accentColor }]} />
                            </View>
                        )}

                        {attachment.status === 'failed' && (
                            <Pressable
                                onPress={() => onRetry(attachment.key)}
                                accessibilityRole="button"
                                accessibilityLabel={label('retry')}
                                style={[StyleSheet.absoluteFill, styles.failed, { backgroundColor: mediaColors.scrim }]}
                            >
                                <Ionicons name="refresh" size={22} color={mediaColors.ink} />
                                <Text style={[type.meta, { color: mediaColors.ink }]}>{t('attachments.failed')}</Text>
                            </Pressable>
                        )}

                        <View style={styles.badges} pointerEvents="none">
                            {attachment.isGif && (
                                <Text style={[type.label, styles.badge, { color: mediaColors.ink, backgroundColor: mediaColors.scrimStrong }]}>GIF</Text>
                            )}
                            <Text
                                style={[
                                    type.label,
                                    styles.badge,
                                    described
                                        ? { color: colors.buttonTextColor, backgroundColor: colors.accentColor }
                                        : { color: mediaColors.ink, backgroundColor: mediaColors.scrimStrong },
                                ]}
                            >
                                {described ? '✓ ALT' : '+ ALT'}
                            </Text>
                        </View>

                        {/* A video's length, bottom left (above the progress bar while it uploads) */}
                        {attachment.isVideo && (
                            <Text
                                pointerEvents="none"
                                style={[
                                    type.label,
                                    styles.badge,
                                    styles.duration,
                                    attachment.status === 'uploading' && styles.durationAboveProgress,
                                    { color: mediaColors.ink, backgroundColor: mediaColors.scrimStrong },
                                ]}
                            >
                                {attachment.duration ? `▶ ${duration(attachment.duration)}` : '▶'}
                            </Text>
                        )}

                        {!attachment.isGif && !attachment.isVideo && !attachment.existing && attachment.status !== 'failed' && (
                            <Pressable
                                onPress={() => onEdit(attachment.key)}
                                accessibilityRole="button"
                                accessibilityLabel={label('edit')}
                                hitSlop={8}
                                style={[styles.corner, styles.edit, { backgroundColor: mediaColors.scrimStrong }]}
                            >
                                <Ionicons name="crop" size={14} color={mediaColors.ink} />
                            </Pressable>
                        )}

                        <Pressable
                            onPress={() => onRemove(attachment.key)}
                            accessibilityRole="button"
                            accessibilityLabel={label('remove')}
                            hitSlop={8}
                            style={[styles.corner, styles.remove, { backgroundColor: mediaColors.scrimStrong }]}
                        >
                            <Ionicons name="close" size={16} color={mediaColors.ink} />
                        </Pressable>
                    </View>
                );
            })}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    // Scrolls edge to edge, but starts in line with the other compose blocks
    strip: {
        gap: space.sm,
        paddingVertical: space.sm,
        paddingHorizontal: space.lg,
    },
    thumb: {
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        borderRadius: radii.input,
        overflow: 'hidden',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    progressTrack: {
        position: 'absolute',
        left: space.sm,
        right: space.sm,
        bottom: space.sm,
        height: 4,
        borderRadius: radii.pill,
        overflow: 'hidden',
    },
    // Leaves the bottom right corner to the edit button
    progressTrackBesideEdit: {
        right: 24 + space.xs * 2,
    },
    progressBar: {
        height: '100%',
    },
    failed: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
    },
    // Stops short of the remove button, wrapping onto a second line when the badges don't fit
    badges: {
        position: 'absolute',
        left: space.xs,
        top: space.xs,
        right: 24 + space.xs * 2,
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        gap: space.xs,
    },
    badge: {
        fontSize: 10,
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: radii.pill,
        overflow: 'hidden',
    },
    duration: {
        position: 'absolute',
        left: space.xs,
        bottom: space.xs,
    },
    durationAboveProgress: {
        bottom: space.sm + 4 + space.xs,
    },
    corner: {
        position: 'absolute',
        width: 24,
        height: 24,
        borderRadius: radii.pill,
        alignItems: 'center',
        justifyContent: 'center',
    },
    remove: {
        right: space.xs,
        top: space.xs,
    },
    edit: {
        right: space.xs,
        bottom: space.xs,
    },
});
