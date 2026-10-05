import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { InstanceConfiguration } from '../mastodon/instance';
import { UploadFile } from '../mastodon/media';

// What the picker hands back for an image
export interface PickedImage {
    uri: string;
    width: number;
    height: number;
    mimeType?: string | null;
    fileName?: string | null;
    fileSize?: number | null;
}

type MediaLimits = Pick<InstanceConfiguration, 'imageSizeLimit' | 'imageMatrixLimit' | 'supportedMimeTypes'>;

// Re-encoding quality: close to the original, much smaller than a camera's file
const JPEG_QUALITY = 0.9;

const EXTENSION_TYPES: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    heic: 'image/heic',
    heif: 'image/heif',
};

const extensionOf = (name?: string | null) => name?.split('?')[0].split('.').pop()?.toLowerCase();

// The picker usually knows the type; otherwise the file name or uri tells
export const imageType = (image: Pick<PickedImage, 'mimeType' | 'fileName' | 'uri'>) =>
    image.mimeType?.toLowerCase() || EXTENSION_TYPES[extensionOf(image.fileName) ?? extensionOf(image.uri) ?? ''] || 'image/jpeg';

export type PreparePlan =
    | { action: 'keep' }
    // Re-encode as JPEG, scaled down to fit the server's pixel limit when given
    | { action: 'convert'; width?: number; height?: number };

// What an image needs before the server will take it. GIFs go as they are: re-encoding flattens them.
export const preparePlan = (image: PickedImage, limits: MediaLimits): PreparePlan => {
    const type = imageType(image);
    if (type === 'image/gif') return { action: 'keep' };

    const pixels = image.width * image.height;
    const tooManyPixels = limits.imageMatrixLimit > 0 && pixels > limits.imageMatrixLimit;
    if (tooManyPixels) {
        const scale = Math.sqrt(limits.imageMatrixLimit / pixels);
        return { action: 'convert', width: Math.floor(image.width * scale), height: Math.floor(image.height * scale) };
    }

    // HEIC from iPhones, or anything else the server doesn't list
    const unsupported = type === 'image/heic' || type === 'image/heif' || (limits.supportedMimeTypes.length > 0 && !limits.supportedMimeTypes.includes(type));
    const tooBig = !!image.fileSize && image.fileSize > limits.imageSizeLimit;
    return unsupported || tooBig ? { action: 'convert' } : { action: 'keep' };
};

const baseName = (image: PickedImage) => (image.fileName ?? image.uri.split('/').pop() ?? 'image').replace(/\.[^.]*$/, '') || 'image';

// The file to upload: the picked one, or a JPEG copy that fits the server's limits
export async function prepareImage(image: PickedImage, limits: MediaLimits): Promise<UploadFile> {
    const plan = preparePlan(image, limits);
    if (plan.action === 'keep') {
        const type = imageType(image);
        const extension = Object.keys(EXTENSION_TYPES).find(key => EXTENSION_TYPES[key] === type) ?? 'jpg';
        return { uri: image.uri, name: `${baseName(image)}.${extension}`, type };
    }

    const context = ImageManipulator.manipulate(image.uri);
    if (plan.width && plan.height) context.resize({ width: plan.width, height: plan.height });
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
    return { uri: saved.uri, name: `${baseName(image)}.jpg`, type: 'image/jpeg' };
}
