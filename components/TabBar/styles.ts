import { StyleSheet, Platform } from 'react-native';

export const styles = StyleSheet.create({
    tabBarContainer: {
        flexDirection: 'row',
        height: Platform.OS === 'ios' ? 85 : 70,
        borderTopWidth: 1,
        paddingBottom: Platform.OS === 'ios' ? 20 : 10,
        paddingTop: 8,
        alignItems: 'center',
        justifyContent: 'space-around',
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
    },
    tabLabel: {
        fontSize: 11,
        marginTop: 4,
        fontWeight: '600',
    },
    composeButtonContainer: {
        width: 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
    composeButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
            },
            android: {
                elevation: 6,
            },
            web: {
                boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.3)',
            }
        }),
        // Slight lift up
        transform: [{ translateY: -6 }],
    },
});
