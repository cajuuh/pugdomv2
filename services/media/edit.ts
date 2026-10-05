import { FlipType, ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { cropPixels, ImageEdits, isEdited, isFullCrop } from './geometry';
import { imageType, PickedImage } from './prepare';

// Close to the original; the upload step shrinks it further if the server needs
const QUALITY = 0.92;

// A new image file with the edits applied: turned, mirrored, then cropped
export async function applyEdits(image: PickedImage, edits: ImageEdits): Promise<PickedImage> {
    if (!isEdited(edits)) return image;

    const turned = ImageManipulator.manipulate(image.uri);
    if (edits.rotation) turned.rotate(edits.rotation);
    if (edits.flipped) turned.flip(FlipType.Horizontal);
    let rendered = await turned.renderAsync();

    if (!isFullCrop(edits.crop)) {
        // In the pixels actually rendered: the picker's size can miss the photo's orientation
        const cropping = ImageManipulator.manipulate(rendered);
        cropping.crop(cropPixels(edits.crop, { width: rendered.width, height: rendered.height }));
        rendered = await cropping.renderAsync();
    }

    // PNGs stay PNG (they may be transparent); everything else becomes JPEG
    const png = imageType(image) === 'image/png';
    const saved = await rendered.saveAsync({ format: png ? SaveFormat.PNG : SaveFormat.JPEG, compress: QUALITY });
    const name = (image.fileName ?? 'image').replace(/\.[^.]*$/, '') || 'image';
    return {
        uri: saved.uri,
        width: saved.width,
        height: saved.height,
        mimeType: png ? 'image/png' : 'image/jpeg',
        fileName: `${name}.${png ? 'png' : 'jpg'}`,
    };
}
