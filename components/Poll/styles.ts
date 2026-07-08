import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
    container: {
        marginTop: 12,
        marginBottom: 8,
    },
    optionContainer: {
        marginBottom: 10,
    },
    optionTouchable: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        marginRight: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxSelected: {
        borderWidth: 0,
    },
    checkboxMultiple: {
        borderRadius: 4,
    },
    optionTextContainer: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    optionTitle: {
        fontSize: 15,
        flex: 1,
    },
    optionPercent: {
        fontSize: 13,
        marginLeft: 10,
    },
    progressBarBackground: {
        height: 6,
        borderRadius: 3,
        marginTop: 6,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    footerText: {
        fontSize: 13,
    },
    voteButton: {
        marginTop: 8,
        alignSelf: 'flex-start',
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 16,
    },
    voteButtonText: {
        fontSize: 14,
        fontWeight: 'bold',
    },
});
