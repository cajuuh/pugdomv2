import { StyleSheet, Platform } from 'react-native';
import { ThemeColors } from '../../services/themeContext';

export const DOCK_HEIGHT = 64;
export const DOCK_BOTTOM_OFFSET = Platform.OS === 'ios' ? 30 : 20;

// Bottom padding for scrollable tab screens so their last item can scroll above the floating dock
export const TAB_BAR_CLEARANCE = DOCK_HEIGHT + DOCK_BOTTOM_OFFSET + 16;

export const makeStyles = (colors: ThemeColors) => StyleSheet.create({
    dockWrapper: {
        position: 'absolute',
        bottom: DOCK_BOTTOM_OFFSET,
        left: 20,
        right: 20,
        alignItems: 'center',
        zIndex: 100, // Make sure it sits above the feed
    },
    tabBarContainer: {
        flexDirection: 'row',
        height: DOCK_HEIGHT,
        borderRadius: DOCK_HEIGHT / 2,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        width: '100%',
        overflow: 'hidden',
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
    },
    centerActionWrapper: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
    },
    centerActionButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: colors.shadowColor,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
        marginBottom: 8, // Make it protrude slightly upwards
    },
});
