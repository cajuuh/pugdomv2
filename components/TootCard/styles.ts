import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
    cardContainer: {
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginHorizontal: 16,
        marginVertical: 8,
        borderWidth: 1,
    },
    boostedHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 6
    },
    boostedAvatar: {
        marginHorizontal: 6,
        borderRadius: 9
    },
    boostedText: {
        fontSize: 12,
        color: '#94A3B8',
        fontWeight: '600'
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10
    },
    mainRow: {
        flexDirection: 'row',
    },
    leftColumn: {
        alignItems: 'center',
        marginRight: 10,
    },
    rightColumn: {
        flex: 1,
    },
    namesContainer: {
        flex: 1,
        justifyContent: 'center'
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap'
    },
    displayName: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#F8FAFC',
        marginRight: 4
    },
    username: {
        fontSize: 13,
        color: '#94A3B8'
    },
    timeText: {
        fontSize: 12,
        color: '#64748B'
    },
    spoilerContainer: {
        backgroundColor: '#0F172A',
        padding: 12,
        borderRadius: 10,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#334155',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    spoilerText: {
        color: '#E2E8F0',
        fontSize: 14,
        fontWeight: '600',
        flex: 1
    },
    spoilerButtonLabel: {
        fontSize: 12,
        fontWeight: 'bold'
    },
    contentContainer: {
        marginBottom: 12
    },
    contentText: {
        fontSize: 15,
        lineHeight: 22,
        color: '#E2E8F0'
    },
    mediaContainer: {
        width: '100%',
        height: 200,
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 12,
        backgroundColor: '#0F172A'
    },
    singleMedia: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover'
    },
    mediaGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12
    },
    gridMedia: {
        height: 120,
        borderRadius: 8,
        backgroundColor: '#0F172A',
        resizeMode: 'cover'
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: '#334155',
        paddingTop: 12,
        marginTop: 4
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 8,
        paddingVertical: 4
    },
    actionCount: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '600'
    },
    linkPreviewContainer: {
        backgroundColor: '#0F172A',
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#334155',
        marginBottom: 12,
    },
    linkPreviewImage: {
        width: '100%',
        height: 150,
        resizeMode: 'cover',
    },
    linkPreviewContent: {
        padding: 12,
        gap: 4,
    },
    linkPreviewProvider: {
        fontSize: 11,
        color: '#6366F1',
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    linkPreviewTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#F8FAFC',
    },
    linkPreviewDescription: {
        fontSize: 12,
        color: '#94A3B8',
        lineHeight: 16,
    },
    imageViewerNavButton: {
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
    imageViewerNavLeft: {
        left: 16,
    },
    imageViewerNavRight: {
        right: 16,
    },
    blurContainer: {
        overflow: 'hidden',
        borderRadius: 12,
        marginBottom: 12,
    },
    revealButton: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
    },
    revealText: {
        color: '#FFF',
        marginTop: 8,
        fontWeight: 'bold',
        fontSize: 14,
    },
    closeButton: {
        position: 'absolute',
        top: 50,
        right: 20,
        zIndex: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderRadius: 20,
        padding: 4,
    }
});