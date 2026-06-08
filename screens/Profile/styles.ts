import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F172A'
    },
    contentContainer: {
        paddingBottom: 40
    },
    headerBannerContainer: {
        width: '100%',
        height: 160, //magic numbers for now
        backgroundColor: '#1E293B'
    },
    headerBanner: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    gradientFallback: {
        backgroundColor: '#4F46E5'
    },
    profileInfoContainer: {
        paddingHorizontal: 20,
        alignItems: 'center'
    },
    avatarWrapper: {
        marginTop: -45,
        marginBottom: 16
    },
    avatarBorder: {
        borderWidth: 4,
        borderColor: '#0F172A',
        borderRadius: 50
    },
    displayName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#F8FAFC',
        textAlign: 'center'
    },
    username: {
        fontSize: 14,
        color: '#94A3B8',
        marginTop: 4,
        marginBottom: 24,
        textAlign: 'center'
    },
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 28,
        gap: 12
    },
    statsCard: {
        flex: 1,
        backgroundColor: '#1E293B',
        paddingVertical: 16,
        alignItems: 'center',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#334155'
    },
    statNumber: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#F8FAFC'
    },
    statLabel: {
        fontSize: 12,
        color: '#94A3B8',
        marginTop: 4
    },
    bioContainer: {
        width: '100%',
        backgroundColor: '#1E293B',
        padding: 20,
        borderRadius: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#334155'
    },
    bioTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6366F1',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    bioText: {
        fontSize: 15,
        lineHeight: 22,
        color: '#E2E8F0'
    },
    actionButtonsContainer: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 20
    },
    actionButton: {
        flex: 1,
        height: 48,
        borderRadius: 12
    },
    outlineButton: {
        backgroundColor: 'transparent'
    },
    buttonLabel: {
        fontSize: 15,
        fontWeight: '600'
    },
    logoutButton: {
        marginTop: 12,
        height: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center'
    },
    logoutLabel: {
        fontSize: 15,
        fontWeight: '600'
    }
})