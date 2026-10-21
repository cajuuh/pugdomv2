import { Image } from 'react-native';
import type { ResolvedSharePayload } from 'expo-sharing';
import { PickedImage } from './media/prepare';

// Something another app shared with pugdon, as the start of a post
export interface SharedContent {
    text: string;
    media: PickedImage[];
}

// Shares don't say how big a picture is; the server's pixel limit needs it
const imageSize = (uri: string) =>
    new Promise<{ width: number; height: number }>(resolve =>
        Image.getSize(uri, (width, height) => resolve({ width, height }), () => resolve({ width: 0, height: 0 }))
    );

// Text and links become the post's words; pictures and a video its media (Compose keeps what fits)
export async function sharedContent(payloads: ResolvedSharePayload[]): Promise<SharedContent> {
    const text = payloads
        .filter(payload => payload.shareType === 'text' || payload.shareType === 'url')
        .map(payload => payload.value.trim())
        .filter(Boolean)
        .join('\n');
    const files = payloads.filter(payload => payload.shareType === 'image' || payload.shareType === 'video');
    const media = await Promise.all(
        files.map(async (payload): Promise<PickedImage> => {
            const uri = payload.contentUri ?? payload.value;
            const video = payload.shareType === 'video';
            return {
                uri,
                ...(video ? { width: 0, height: 0 } : await imageSize(uri)),
                mimeType: payload.contentMimeType ?? payload.mimeType ?? null,
                fileName: payload.originalName,
                fileSize: payload.contentSize,
                type: video ? 'video' : 'image',
            };
        })
    );
    return { text, media };
}
