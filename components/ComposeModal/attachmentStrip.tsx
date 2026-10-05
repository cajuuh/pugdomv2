import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../services/themeContext';
import { useI18n } from '../../services/i18n/i18nContext';
import { mediaColors } from '../../services/theme/media';
import { radii, space } from '../../services/theme/shape';
import { ComposeAttachment } from '../../hooks/useMediaAttachments';

const THUMB_SIZE = 104;

interface AttachmentStripProps {
    attachments: ComposeAttachment[];
    // Opens the description editor
    onDescribe: (key: string) => void;
    onRemove: (key: string) => void;
    onRetry: (key: string) => void;
}

// The images attached to a post: each shows its upload progress, an ALT badge once described,
// and buttons to remove it or retry a failed upload. Tapping one edits its description.
export const AttachmentStrip: React.FC<AttachmentStripProps> = ({ attachments, onDescribe, onRemove, onRetry }) => {
    const { colors, type } = useTheme();
    const { t } = useI18n();
    if (attachments.length === 0) return null;

    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip} keyboardShouldPersistTaps="handled">
            {attachments.map((attachment, position) => {
                const index = position + 1;
                const described = attachment.description.trim().length > 0;
                return (
                    <View key={attachment.key} style={[styles.thumb, { backgroundColor: colors.inputBackground }]}>
                        <Pressable
                            onPress={() => onDescribe(attachment.key)}
                            accessibilityRole="button"
                            accessibilityLabel={t('attachments.describe', { index })}
                            accessibilityValue={described ? { text: attachment.description } : undefined}
                            style={StyleSheet.absoluteFill}
                        >
                            <Image source={{ uri: attachment.uri }} style={styles.image} resizeMode="cover" />
                        </Pressable>

                        {attachment.status === 'uploading' && (
                            <View
                                style={[styles.progressTrack, { backgroundColor: mediaColors.scrim }]}
                                accessible
                                accessibilityRole="progressbar"
                                accessibilityLabel={t('attachments.uploading', { index })}
                                accessibilityValue={{ min: 0, max: 100, now: Math.round(attachment.progress * 100) }}
                            >
                                <View style={[styles.progressBar, { width: `${Math.round(attachment.progress * 100)}%`, backgroundColor: colors.accentColor }]} />
                            </View>
                        )}

                        {attachment.status === 'failed' && (
                            <Pressable
                                onPress={() => onRetry(attachment.key)}
                                accessibilityRole="button"
                                accessibilityLabel={t('attachments.retry', { index })}
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

                        <Pressable
                            onPress={() => onRemove(attachment.key)}
                            accessibilityRole="button"
                            accessibilityLabel={t('attachments.remove', { index })}
                            hitSlop={8}
                            style={[styles.remove, { backgroundColor: mediaColors.scrimStrong }]}
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
    strip: {
        gap: space.sm,
        paddingVertical: space.sm,
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
    progressBar: {
        height: '100%',
    },
    failed: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
    },
    badges: {
        position: 'absolute',
        left: space.xs,
        top: space.xs,
        flexDirection: 'row',
        gap: space.xs,
    },
    badge: {
        fontSize: 10,
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: radii.pill,
        overflow: 'hidden',
    },
    remove: {
        position: 'absolute',
        right: space.xs,
        top: space.xs,
        width: 24,
        height: 24,
        borderRadius: radii.pill,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
