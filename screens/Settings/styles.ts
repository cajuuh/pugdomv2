import { StyleSheet, Platform } from 'react-native';

export const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#0F172A',
    },
    container: {
        flex: 1,
        backgroundColor: '#0F172A',
    },
    contentContainer: {
        padding: 16,
        paddingBottom: 40,
    },
    header: {
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#334155',
        backgroundColor: '#1E293B',
    },
    backButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#F8FAFC',
    },
    placeholder: {
        width: 44,
    },
    userCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#1E293B',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#334155',
        marginBottom: 24,
    },
    userAvatar: {
        borderWidth: 2,
        borderColor: '#6366F1',
    },
    userInfo: {
        marginLeft: 16,
        flex: 1,
    },
    displayName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#F8FAFC',
    },
    username: {
        fontSize: 14,
        color: '#94A3B8',
        marginTop: 2,
    },
    instanceText: {
        fontSize: 11,
        color: '#6366F1',
        fontWeight: '600',
        marginTop: 4,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748B',
        letterSpacing: 1,
        marginBottom: 8,
        marginLeft: 4,
    },
    settingsGroup: {
        backgroundColor: '#1E293B',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#334155',
        marginBottom: 24,
        overflow: 'hidden',
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
        height: 54,
    },
    settingLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    rowIcon: {
        marginRight: 12,
        width: 24,
        textAlign: 'center',
    },
    settingLabel: {
        fontSize: 15,
        color: '#F8FAFC',
        fontWeight: '500',
    },
    settingValue: {
        fontSize: 14,
        color: '#94A3B8',
    },
    divider: {
        height: 1,
        backgroundColor: '#334155',
        marginHorizontal: 16,
    },
    logoutButton: {
        marginTop: 8,
        height: 48,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoutLabel: {
        fontSize: 16,
        fontWeight: '600',
    },
});
