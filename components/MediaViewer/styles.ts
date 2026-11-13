import { StyleSheet } from 'react-native';
import { mediaColors } from '../../services/theme/media';

export const styles = StyleSheet.create({
    videoContainer: {
        flex: 1,
        backgroundColor: mediaColors.backdrop,
        justifyContent: 'center',
    },
    video: {
        width: '100%',
        height: '80%',
    },
    audioCover: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 64,
    },
    audioCoverImage: {
        width: '100%',
        height: '100%',
    },
    audioControls: {
        paddingHorizontal: 24,
        gap: 12,
    },
    // Taller than the line it draws, so it's easy to tap
    audioTrackHit: {
        paddingVertical: 12,
    },
    audioTrack: {
        height: 4,
        borderRadius: 2,
        overflow: 'hidden',
    },
    // The unplayed part: the ink, faint (the backdrop is always black)
    audioTrackBase: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        backgroundColor: mediaColors.ink,
        opacity: 0.3,
    },
    audioTrackFill: {
        height: '100%',
        backgroundColor: mediaColors.ink,
    },
    audioTime: {
        color: mediaColors.ink,
        textAlign: 'center',
    },
    audioButtons: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'flex-start',
    },
    audioButton: {
        alignItems: 'center',
        gap: 6,
        minWidth: 88,
    },
    // As tall as the play button, so the three labels line up
    audioIcon: {
        width: 48,
        height: 64,
        alignItems: 'center',
        justifyContent: 'center',
    },
    audioIconBig: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: mediaColors.ink,
    },
    closeButton: {
        position: 'absolute',
        right: 20,
        zIndex: 10,
        backgroundColor: mediaColors.scrim,
        borderRadius: 20,
        padding: 4,
    },
    openPostButton: {
        position: 'absolute',
        left: 20,
        zIndex: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 38,
        paddingHorizontal: 14,
        borderRadius: 19,
        backgroundColor: mediaColors.scrim,
    },
});
