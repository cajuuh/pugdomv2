import { StyleSheet, Platform } from 'react-native';

export const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
    },
    header: {
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    headerButton: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    headerButtonText: {
        fontSize: 15,
        fontWeight: '600',
    },
    publishButton: {
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 6,
        justifyContent: 'center',
        alignItems: 'center',
    },
    publishButtonDisabled: {
        opacity: 0.5,
    },
    publishButtonText: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    scrollContainer: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    /* Reply Preview Card */
    replyPreview: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
    },
    replyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
        gap: 8,
    },
    replyDisplayName: {
        fontSize: 13,
        fontWeight: 'bold',
    },
    replyUsername: {
        fontSize: 11,
    },
    replyContent: {
        fontSize: 13,
        lineHeight: 18,
    },
    /* Author Section */
    authorSection: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 10,
    },
    authorName: {
        fontSize: 15,
        fontWeight: '600',
    },
    /* Input Section */
    spoilerInputContainer: {
        marginBottom: 12,
    },
    spoilerInput: {
        height: 40,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        fontSize: 14,
    },
    textArea: {
        minHeight: 120,
        fontSize: 16,
        lineHeight: 22,
        textAlignVertical: 'top',
        padding: 0,
    },
    /* Settings Row */
    settingsContainer: {
        borderTopWidth: 1,
        marginTop: 20,
        paddingTop: 12,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
    },
    settingLabel: {
        fontSize: 14,
        fontWeight: '600',
    },
    /* Footer */
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
    },
    charCounter: {
        fontSize: 14,
        fontWeight: '700',
    },
});
