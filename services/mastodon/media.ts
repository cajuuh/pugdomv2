import apiClient from '../api/client';
import { getCredentials } from '../storage';
import { Attachment } from './types';
import { Point, toMastodonFocus } from '../media/geometry';

// A file on the device, ready to send
export interface UploadFile {
    uri: string;
    name: string;
    type: string;
}

// The server may still be processing it, until then without a url
export type UploadedMedia = Omit<Attachment, 'url'> & { url: string | null };

// Large images take a while on slow connections
const UPLOAD_TIMEOUT = 120000;
// How often, and how many times, to ask whether the server has finished processing an upload
export const PROCESSING_POLL_MS = 1000;
const PROCESSING_POLL_TRIES = 60;

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Uploads an image to the active account's server. Answers 202 while the server is still processing
// it; then this waits until it's done, since a post can't use media that isn't ready.
export async function uploadMedia(
    file: UploadFile,
    { onProgress, signal }: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {}
): Promise<UploadedMedia> {
    // v2 needs the full URL: apiClient's base is /api/v1
    const { instanceUrl } = await getCredentials();
    if (!instanceUrl) throw new Error('No active instance');

    const form = new FormData();
    // React Native's FormData sends a file given its uri, name and type
    form.append('file', file as unknown as Blob);

    const response = await apiClient.post<UploadedMedia>(`${instanceUrl}/api/v2/media`, form, {
        // Not JSON (the client's default): React Native adds the multipart boundary
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: UPLOAD_TIMEOUT,
        signal,
        onUploadProgress: event => {
            if (event.total) onProgress?.(Math.min(event.loaded / event.total, 1));
        },
    });

    if (response.status === 202 || !response.data.url) {
        return waitForProcessing(response.data.id, signal);
    }
    return response.data;
}

// GET /media/:id answers 206 until the server has processed the file
export async function waitForProcessing(id: string, signal?: AbortSignal): Promise<UploadedMedia> {
    for (let tries = 0; tries < PROCESSING_POLL_TRIES; tries++) {
        await wait(PROCESSING_POLL_MS);
        if (signal?.aborted) throw new Error('Upload cancelled');
        const response = await apiClient.get<UploadedMedia>(`/media/${id}`, { signal });
        if (response.status === 200 && response.data.url) return response.data;
    }
    throw new Error('The server took too long to process this file');
}

// Alt text and the focal point (0–1 from the top left) can change until the post is published
export async function updateMedia(id: string, { description, focus }: { description: string; focus?: Point }): Promise<UploadedMedia> {
    const body: { description: string; focus?: string } = { description };
    if (focus) {
        const { x, y } = toMastodonFocus(focus);
        body.focus = `${x.toFixed(2)},${y.toFixed(2)}`;
    }
    const response = await apiClient.put<UploadedMedia>(`/media/${id}`, body);
    return response.data;
}
