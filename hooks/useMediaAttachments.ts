import { useCallback, useEffect, useRef, useState } from 'react';
import { InstanceConfiguration } from '../services/mastodon/instance';
import { updateMedia, uploadMedia } from '../services/mastodon/media';
import { imageType, PickedImage, prepareImage } from '../services/media/prepare';
import { ImageEdits, NO_EDITS } from '../services/media/geometry';

export interface ComposeAttachment {
    key: string;
    // The picked image, shown while (and after) it uploads
    uri: string;
    width: number;
    height: number;
    isGif: boolean;
    status: 'uploading' | 'ready' | 'failed';
    // 0–1, while uploading
    progress: number;
    mediaId?: string;
    description: string;
    // What the server has, so publishing only sends descriptions that changed
    savedDescription: string;
}

type Limits = Pick<InstanceConfiguration, 'maxMediaAttachments' | 'imageSizeLimit' | 'imageMatrixLimit' | 'supportedMimeTypes'>;

// Images attached to the post being written. Each one uploads as soon as it's picked, so it's ready
// by the time you post; removing one cancels its upload.
export const useMediaAttachments = (limits: Limits) => {
    const [attachments, setAttachments] = useState<ComposeAttachment[]>([]);
    // Per attachment: the image being uploaded, and the picked original with the edits that made it
    const uploads = useRef(new Map<string, { image: PickedImage; original: PickedImage; edits: ImageEdits; controller: AbortController }>());
    const nextKey = useRef(0);
    // Latest limits for uploads started from callbacks
    const limitsRef = useRef(limits);
    limitsRef.current = limits;
    // Counts attachments added but not rendered yet, so two quick picks can't go over the limit
    const count = useRef(0);
    count.current = Math.max(count.current, attachments.length);

    const update = useCallback((key: string, patch: Partial<ComposeAttachment>) => {
        setAttachments(list => list.map(attachment => (attachment.key === key ? { ...attachment, ...patch } : attachment)));
    }, []);

    const start = useCallback(async (key: string, image: PickedImage, history?: { original: PickedImage; edits: ImageEdits }) => {
        const controller = new AbortController();
        uploads.current.set(key, { image, original: history?.original ?? image, edits: history?.edits ?? NO_EDITS, controller });
        try {
            const file = await prepareImage(image, limitsRef.current);
            if (controller.signal.aborted) return;
            const media = await uploadMedia(file, {
                signal: controller.signal,
                onProgress: progress => update(key, { progress }),
            });
            if (!controller.signal.aborted) update(key, { status: 'ready', progress: 1, mediaId: media.id });
        } catch (error) {
            // A removed attachment's upload is cancelled on purpose
            if (!controller.signal.aborted) {
                console.warn('Media upload failed:', error);
                update(key, { status: 'failed' });
            }
        }
    }, [update]);

    // Adds what fits in the remaining slots
    const add = useCallback((images: PickedImage[]) => {
        const room = Math.max(limitsRef.current.maxMediaAttachments - count.current, 0);
        const picked = images.slice(0, room);
        const added: ComposeAttachment[] = picked.map(image => ({
            key: `media-${nextKey.current++}`,
            uri: image.uri,
            width: image.width,
            height: image.height,
            isGif: imageType(image) === 'image/gif',
            status: 'uploading',
            progress: 0,
            description: '',
            savedDescription: '',
        }));
        count.current += added.length;
        setAttachments(list => [...list, ...added]);
        added.forEach((attachment, index) => start(attachment.key, picked[index]));
    }, [start]);

    const retry = useCallback((key: string) => {
        const upload = uploads.current.get(key);
        if (!upload) return;
        update(key, { status: 'uploading', progress: 0 });
        start(key, upload.image, upload);
    }, [start, update]);

    // The picked image and the edits so far, for the editor to start from
    const editsFor = useCallback((key: string) => {
        const upload = uploads.current.get(key);
        return upload ? { original: upload.original, edits: upload.edits } : null;
    }, []);

    // Swaps in an edited image (made from the original) and uploads it in place of the last one
    const edit = useCallback((key: string, edited: PickedImage, edits: ImageEdits) => {
        const upload = uploads.current.get(key);
        if (!upload) return;
        upload.controller.abort();
        update(key, {
            uri: edited.uri,
            width: edited.width,
            height: edited.height,
            status: 'uploading',
            progress: 0,
            mediaId: undefined,
            // The description stays, but the new upload doesn't have it yet
            savedDescription: '',
        });
        start(key, edited, { original: upload.original, edits });
    }, [start, update]);

    const remove = useCallback((key: string) => {
        uploads.current.get(key)?.controller.abort();
        uploads.current.delete(key);
        count.current = Math.max(count.current - 1, 0);
        setAttachments(list => list.filter(attachment => attachment.key !== key));
    }, []);

    const describe = useCallback((key: string, description: string) => update(key, { description }), [update]);

    // Stops every upload; the attachments stay until reset
    const cancel = useCallback(() => {
        uploads.current.forEach(upload => upload.controller.abort());
    }, []);

    const reset = useCallback(() => {
        cancel();
        uploads.current.clear();
        count.current = 0;
        setAttachments([]);
    }, [cancel]);

    // Sends the descriptions that changed, then gives the ids to post with, in order
    const finish = useCallback(async () => {
        const ready = attachments.filter(attachment => attachment.mediaId);
        await Promise.all(
            ready
                .filter(attachment => attachment.description.trim() !== attachment.savedDescription)
                .map(async attachment => {
                    const description = attachment.description.trim();
                    await updateMedia(attachment.mediaId!, { description });
                    update(attachment.key, { savedDescription: description });
                })
        );
        return ready.map(attachment => attachment.mediaId!);
    }, [attachments, update]);

    useEffect(() => cancel, [cancel]);

    return {
        attachments,
        add,
        retry,
        remove,
        describe,
        editsFor,
        edit,
        reset,
        cancel,
        finish,
        room: Math.max(limits.maxMediaAttachments - attachments.length, 0),
        // Post waits until every upload is done (a failed one has to be retried or removed)
        pending: attachments.some(attachment => attachment.status !== 'ready'),
        missingDescription: attachments.filter(attachment => attachment.description.trim().length === 0),
    };
};
