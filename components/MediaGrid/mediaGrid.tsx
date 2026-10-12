import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
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
    index: number;
}

// A profile's media posts as rows of thumbnails, one per picture or video (boosts are left out)
export const toMediaRows = (statuses: Status[]): MediaTile[][] => {
    const tiles = statuses.flatMap(status =>
        status.reblog
            ? []
            : status.media_attachments
                  .map((attachment, index) => ({ status, index, attachment }))
                  .filter(tile => VISUAL_TYPES.includes(tile.attachment.type))
                  .map(({ status, index }) => ({ status, index }))
    );
    const rows: MediaTile[][] = [];
    for (let i = 0; i < tiles.length; i += COLUMNS) rows.push(tiles.slice(i, i + COLUMNS));
    return rows;
};

interface MediaGridRowProps {
    row: MediaTile[];
    // Opens the post; by default its thread, like a post card
    onStatusPress?: (statusId: string) => void;
}

// Tapping a thumbnail opens the viewer; a long press opens its post. Sensitive ones stay blurred.
export const MediaGridRow: React.FC<MediaGridRowProps> = ({ row, onStatusPress }) => {
    const { colors } = useTheme();
    const i18n = useI18n();
    const { openMedia } = useMediaViewer();
    const { push } = useNavigator();
    const openPost = (statusId: string) => (onStatusPress ? onStatusPress(statusId) : push({ name: 'thread', statusId }));

    return (
        <View style={styles.row}>
            {row.map(({ status, index }) => {
                const attachments = status.media_attachments;
                const attachment = attachments[index];
                return (
                    <Pressable
                        key={`${status.id}-${index}`}
                        style={[styles.tile, { backgroundColor: colors.inputBackground }]}
                        onPress={() => openMedia(attachments, index)}
                        onLongPress={() => openPost(status.id)}
                        accessibilityRole="imagebutton"
                        accessibilityLabel={mediaLabel(attachment, index, attachments.length, i18n)}
                        accessibilityActions={[{ name: 'longpress', label: i18n.t('profile.openPost') }]}
                        onAccessibilityAction={() => openPost(status.id)}
                    >
                        <FocusedImage attachment={attachment} style={StyleSheet.absoluteFill} blurred={status.sensitive} />
                        {(status.sensitive || attachment.type !== 'image') && (
                            <View style={[styles.badge, { backgroundColor: colors.veilStrong }]}>
                                <Ionicons
                                    name={status.sensitive ? 'eye-off-outline' : 'play'}
                                    size={14}
                                    color={colors.textPrimary}
                                />
                            </View>
                        )}
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
    badge: {
        position: 'absolute',
        top: space.xs,
        right: space.xs,
        width: 24,
        height: 24,
        borderRadius: radii.pill,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
