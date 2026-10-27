import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import type { ComposeAttachment } from '../hooks/useMediaAttachments';
import type { Point } from './media/geometry';
import type { PickedImage } from './media/prepare';
import type { QuotePolicy } from './mastodon/quotes';
import type { Status } from './mastodon/types';

export interface DraftMedia {
    // A copy of the picked image or video, kept with the draft and uploaded again on reopening
    image?: PickedImage;
    // Already on the server (a redrafted post's media), kept by id.
    // ponytail: Mastodon removes unattached media after about a day; copy it down if that bites
    existing?: ComposeAttachment;
    description: string;
    focus?: Point;
}

// A post put aside on this phone (Mastodon has no drafts), to finish later
export interface Draft {
    id: string;
    savedAt: string;
    text: string;
    spoilerText: string;
    sensitive: boolean;
    visibility: Status['visibility'];
    language: string;
    quotePolicy: QuotePolicy;
    scheduledAt: string | null;
    poll: { options: string[]; duration: number; multiple: boolean } | null;
    replyTo: Status | null;
    quote: Status | null;
    media: DraftMedia[];
}

export type DraftContent = Omit<Draft, 'id' | 'savedAt'>;

export const draftsStorageKey = (accountId: string) => `pugdom_drafts_${accountId}`;
export const draftsQueryKey = (accountId: string) => ['drafts', accountId];

const draftFolder = (id: string) => new Directory(Paths.document, 'drafts', id);

const removeFiles = (id: string) => {
    try {
        const folder = draftFolder(id);
        if (folder.exists) folder.delete();
    } catch (error) {
        console.warn('Removing a draft’s media failed:', error);
    }
};

// Newest first
export async function getDrafts(accountId: string): Promise<Draft[]> {
    try {
        const raw = await AsyncStorage.getItem(draftsStorageKey(accountId));
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

// Saves a draft (in place of `replacing`, when a reopened draft is saved again), copying its media next to it:
// picked files sit in caches the system may clear
export async function saveDraft(accountId: string, content: DraftContent, replacing?: string): Promise<Draft> {
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const folder = draftFolder(id);
    folder.create({ intermediates: true, idempotent: true });
    const media = await Promise.all(
        content.media.map(async (item, index) => {
            if (!item.image) return item;
            const copy = new File(folder, `${index}${item.image.uri.match(/\.\w+$/)?.[0] ?? ''}`);
            await new File(item.image.uri).copy(copy);
            return { ...item, image: { ...item.image, uri: copy.uri } };
        })
    );
    const draft: Draft = { ...content, media, id, savedAt: new Date().toISOString() };
    const others = (await getDrafts(accountId)).filter(other => other.id !== replacing);
    await AsyncStorage.setItem(draftsStorageKey(accountId), JSON.stringify([draft, ...others]));
    if (replacing) removeFiles(replacing);
    return draft;
}

export async function deleteDraft(accountId: string, id: string): Promise<void> {
    const others = (await getDrafts(accountId)).filter(draft => draft.id !== id);
    await AsyncStorage.setItem(draftsStorageKey(accountId), JSON.stringify(others));
    removeFiles(id);
}
