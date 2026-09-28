import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
    videoContainer: {
        flex: 1,
        backgroundColor: '#000',
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
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderRadius: 20,
        padding: 4,
    },
    navButton: {
        position: 'absolute',
        top: '50%',
        marginTop: -20,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
