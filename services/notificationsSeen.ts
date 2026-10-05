import AsyncStorage from '@react-native-async-storage/async-storage';

// The newest notification seen on this device, per account: opening the tab clears the dot without
// moving the server's read marker ("Mark all as read" still does that)
const seenKey = (accountId: string) => `pugdom_notifications_seen_${accountId}`;

export async function getSeenNotificationId(accountId: string): Promise<string | null> {
    try {
        return await AsyncStorage.getItem(seenKey(accountId));
    } catch {
        return null;
    }
}

export async function setSeenNotificationId(accountId: string, id: string): Promise<void> {
    try {
        await AsyncStorage.setItem(seenKey(accountId), id);
    } catch {
        // A dot that comes back is better than a crash
    }
}
