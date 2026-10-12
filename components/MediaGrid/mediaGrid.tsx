import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Attachment, Status } from '../../services/mastodon/types';
import { useTheme } from '../../services/themeContext';
import { useI18n } from '../../services/i18n/i18nContext';
import { useMediaViewer } from '../MediaViewer/mediaViewer';
import { useNavigator } from '../../services/navigationContext';
import { FocusedImage } from '../TootCard/focusedImage';
import { mediaLabel } from '../TootCard/tootCard';
import { radii, space } from '../../services/theme/shape';
import { CARD_MARGIN } from '../TootCard/styles';

const COLUMNS = 3;
const VISUAL_TYPES: Attachment['type'][] = ['image', 'video', 'gifv'];

export interface MediaTile {
    status: Status;
    // The post's first picture or video, shown on the thumbnail
    index: number;
    // How many pictures and videos the post has
    count: number;
}

// A profile's media posts as rows of thumbnails, one per post (boosts are left out)
export const toMediaRows = (statuses: Status[]): MediaTile[][] => {
    const tiles = statuses.flatMap(status => {
        const visual = status.media_attachments.filter(attachment => VISUAL_TYPES.includes(attachment.type));
        return status.reblog || visual.length === 0
            ? []
            : [{ status, index: status.media_attachments.indexOf(visual[0]), count: visual.length }];
    });
    const rows: MediaTile[][] = [];
    for (let i = 0; i < tiles.length; i += COLUMNS) rows.push(tiles.slice(i, i + COLUMNS));
    return rows;
};

interface MediaGridRowProps {
    row: MediaTile[];
    // Opens the post; by default its thread, like a post card
    onStatusPress?: (statusId: string) => void;
}

// Tapping a thumbnail opens the viewer at the post's first picture, which also offers to open the post;
// a long press opens the post straight away.
// Several pictures get a stacked badge with their number; sensitive ones stay blurred.
export const MediaGridRow: React.FC<MediaGridRowProps> = ({ row, onStatusPress }) => {
    const { colors, type } = useTheme();
    const i18n = useI18n();
    const { openMedia } = useMediaViewer();
    const { push } = useNavigator();
    const openPost = (statusId: string) => (onStatusPress ? onStatusPress(statusId) : push({ name: 'thread', statusId }));

    return (
        <View style={styles.row}>
            {row.map(({ status, index, count }) => {
                const attachments = status.media_attachments;
                const attachment = attachments[index];
                return (
                    <Pressable
                        key={`${status.id}-${index}`}
                        style={[styles.tile, { backgroundColor: colors.inputBackground }]}
                        onPress={() => openMedia(attachments, index, () => openPost(status.id))}
                        onLongPress={() => openPost(status.id)}
                        accessibilityRole="imagebutton"
                        accessibilityLabel={mediaLabel(attachment, index, attachments.length, i18n)}
                        accessibilityActions={[{ name: 'longpress', label: i18n.t('profile.openPost') }]}
                        onAccessibilityAction={() => openPost(status.id)}
                    >
                        <FocusedImage attachment={attachment} style={StyleSheet.absoluteFill} blurred={status.sensitive} />
                        <View style={styles.badges}>
                            {status.sensitive && (
                                <View style={[styles.badge, { backgroundColor: colors.veilStrong }]}>
                                    <Ionicons name="eye-off-outline" size={14} color={colors.textPrimary} />
                                </View>
                            )}
                            {count > 1 ? (
                                <View style={[styles.badge, styles.countBadge, { backgroundColor: colors.veilStrong }]}>
                                    <Ionicons name="copy-outline" size={13} color={colors.textPrimary} />
                                    <Text style={[type.label, styles.countText, { color: colors.textPrimary }]}>{count}</Text>
                                </View>
                            ) : (
                                attachment.type !== 'image' && (
                                    <View style={[styles.badge, { backgroundColor: colors.veilStrong }]}>
                                        <Ionicons name="play" size={14} color={colors.textPrimary} />
                                    </View>
                                )
                            )}
                        </View>
                    </Pressable>
                );
            })}
            {/* Keeps a short last row's thumbnails the same size as the others */}
            {Array.from({ length: COLUMNS - row.length }, (_, i) => <View key={`gap-${i}`} style={styles.gap} />)}
        </View>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        gap: 3,
        paddingHorizontal: CARD_MARGIN,
        marginBottom: 3,
    },
    tile: {
        flex: 1,
        aspectRatio: 1,
        borderRadius: radii.input / 2,
        overflow: 'hidden',
    },
    gap: {
        flex: 1,
    },
    badges: {
        position: 'absolute',
        top: space.xs,
        right: space.xs,
        flexDirection: 'row',
        gap: space.xs,
    },
    badge: {
        minWidth: 24,
        height: 24,
        borderRadius: radii.pill,
        alignItems: 'center',
        justifyContent: 'center',
    },
    countBadge: {
        flexDirection: 'row',
        gap: 3,
        paddingHorizontal: 7,
    },
    countText: {
        fontSize: 11,
        letterSpacing: 0,
    },
});
