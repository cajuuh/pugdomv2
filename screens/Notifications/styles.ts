import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    listContent: {
        paddingBottom: 20,
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
        flexDirection: 'row',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#2C3E50', // placeholder, will use theme colors
    },
    iconContainer: {
        width: 48,
        alignItems: 'flex-end',
        paddingRight: 12,
    },
    contentContainer: {
        flex: 1,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    avatar: {
        marginRight: 10,
    },
    actionText: {
        fontSize: 15,
        fontWeight: '500',
        flex: 1,
    },
    statusPreview: {
        fontSize: 14,
        marginTop: 4,
        opacity: 0.8,
    },
    followCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
    },
    followInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    followName: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    followAcct: {
        fontSize: 14,
        marginTop: 2,
    },
    followButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    }
});
