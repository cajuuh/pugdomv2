import { StyleSheet, Platform } from 'react-native';

export const styles = StyleSheet.create({
    safeArea: {
        borderBottomWidth: 1,
    },
    container: {
        height: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
    },
    avatarContainer: {
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    avatar: {
        borderWidth: 1.5,
    },
    titleContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    titleText: {
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    menuButton: {
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'flex-end',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    dropdownContainer: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 100 : 60,
        right: 16,
        borderRadius: 12,
        borderWidth: 1,
        paddingVertical: 4,
        minWidth: 150,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    dropdownIcon: {
        marginRight: 12,
    },
    dropdownText: {
        fontSize: 14,
        fontWeight: '600',
    },
    divider: {
        height: 1,
        marginHorizontal: 8,
    },
    logoutText: {
    },
});
