import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { Asset, requestPermissionsAsync } from 'expo-media-library';

// Downloads a post's original image or video and saves it to the phone's gallery. Android 11+
// writes through MediaStore, which needs no permission; iOS asks once for add-only access.
// Older Android (no storage permission in the app) throws, and callers offer the link instead.
export async function saveToGallery(url: string) {
    if (Platform.OS === 'ios') {
        const { granted } = await requestPermissionsAsync(true);
        if (!granted) throw new Error('Photo library access denied');
    }
    const folder = new Directory(Paths.cache, 'saved-media');
    folder.create({ idempotent: true });
    // Named after the URL, extension included (the gallery needs it to tell photos from videos)
    const file = await File.downloadFileAsync(url, folder, { idempotent: true });
    try {
        await Asset.create(file.uri);
    } finally {
        file.delete();
    }
}
