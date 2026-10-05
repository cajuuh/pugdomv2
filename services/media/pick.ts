import * as ImagePicker from 'expo-image-picker';
import { PickedImage } from './prepare';

// quality 1 and no editing keep GIFs animated on Android (anything else flattens them to a frame)
const IMAGE_OPTIONS: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, allowsEditing: false, exif: false };

// Images from the gallery, up to `limit`, in the order they were chosen
export async function pickImages(limit: number): Promise<PickedImage[]> {
    if (limit < 1) return [];
    const result = await ImagePicker.launchImageLibraryAsync({
        ...IMAGE_OPTIONS,
        allowsMultipleSelection: limit > 1,
        selectionLimit: limit,
        orderedSelection: true,
    });
    return result.canceled ? [] : result.assets.slice(0, limit);
}

// A new photo, or 'denied' when the camera permission isn't given
export async function takePhoto(): Promise<PickedImage[] | 'denied'> {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return 'denied';
    const result = await ImagePicker.launchCameraAsync(IMAGE_OPTIONS);
    return result.canceled ? [] : result.assets.slice(0, 1);
}
