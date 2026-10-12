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
    navButton: {
        position: 'absolute',
        top: '50%',
        marginTop: -20,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: mediaColors.scrim,
        justifyContent: 'center',
        alignItems: 'center',
    },
    navLeft: {
        left: 16,
    },
    navRight: {
        right: 16,
    },
});
