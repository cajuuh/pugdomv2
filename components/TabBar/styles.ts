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
});
