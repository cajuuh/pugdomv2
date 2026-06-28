import { StyleSheet, Platform } from 'react-native';

export const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
    },
    header: {
        height: 50,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    headerButton: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 8,
    },
    headerButtonText: {
        fontSize: 14,
        fontWeight: '600',
    },
    publishButton: {
        borderRadius: 18,
        paddingHorizontal: 14,
        paddingVertical: 5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    publishButtonDisabled: {
        opacity: 0.5,
    },
    publishButtonText: {
        fontSize: 13,
        fontWeight: 'bold',
    },
    /* Helper Bar under header (now language-only) */
    helperBar: {
        height: 44,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        borderBottomWidth: 1,
    },
    langPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        gap: 4,
    },
    langPillText: {
        fontSize: 11,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    /* Language Dialog Dropdown */
    langModalContainer: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    langSheet: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingVertical: 20,
        paddingHorizontal: 16,
        maxHeight: '60%',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
            },
            android: {
                elevation: 10,
            }
        })
    },
    langSheetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingHorizontal: 4,
    },
    langSheetTitle: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    langOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 10,
        marginVertical: 2,
    },
    langOptionText: {
        fontSize: 14,
        fontWeight: '600',
    },
    scrollContainer: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 20,
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
        fontSize: 14,
        fontWeight: '600',
    },
    /* Input Section */
    spoilerInputContainer: {
        marginBottom: 12,
    },
    spoilerInput: {
        height: 38,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        fontSize: 13,
    },
    textArea: {
        minHeight: 150,
        fontSize: 15,
        lineHeight: 22,
        textAlignVertical: 'top',
        padding: 0,
    },
    /* Bottom Accessory Bar */
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        height: 52,
        borderTopWidth: 1,
    },
    leftAccessoryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    accessoryButton: {
        width: 36,
        height: 36,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    charCounter: {
        fontSize: 13,
        fontWeight: '700',
    },
});
