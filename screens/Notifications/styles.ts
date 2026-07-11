import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    listContent: {
        paddingBottom: 20,
        paddingTop: 10,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '500',
    },
    notificationCard: {
        flexDirection: 'column',
        padding: 16,
        borderRadius: 20,
        marginHorizontal: 16,
        marginBottom: 16,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 3,
    },
    asymmetricTagLayer: {
        position: 'absolute',
        top: 16,
        right: 16,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        zIndex: 2,
    },
    tagText: {
        fontSize: 11,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    headerArchitecture: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        paddingRight: 80, // Prevent overlap with asymmetric tag
    },
    avatar: {
        marginRight: 12,
    },
    actionText: {
        fontSize: 15,
        fontWeight: '500',
        flexShrink: 1,
    },
    statusPreview: {
        fontSize: 15,
        lineHeight: 22,
        marginTop: 4,
        opacity: 0.9,
    },
    followButton: {
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
        marginTop: 12,
        alignSelf: 'flex-start',
    }
});
