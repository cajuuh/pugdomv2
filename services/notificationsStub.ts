// Stands in for expo-notifications in the F-Droid build (metro.config.js), which leaves out its native module and
// Firebase. Covers only what pugdon calls (__tests__/notificationsStub.test.ts checks); push stays off there.
export const DEFAULT_ACTION_IDENTIFIER = 'expo.modules.notifications.actions.DEFAULT';
export enum AndroidImportance { HIGH = 5 }

const denied = { granted: false, canAskAgain: false, status: 'denied' };

export const setNotificationHandler = (_handler: unknown) => {};
export const useLastNotificationResponse = () => null;
export const clearLastNotificationResponse = () => {};
export const setNotificationChannelAsync = async (_id: string, _channel: unknown) => null;
export const getPermissionsAsync = async () => denied;
export const requestPermissionsAsync = async () => denied;
export const getExpoPushTokenAsync = async (_options?: unknown): Promise<{ data: string }> => {
    throw new Error('Push notifications are not in this build');
};
