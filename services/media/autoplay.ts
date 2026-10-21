import { useSyncExternalStore } from 'react';
import { ViewToken } from '@shopify/flash-list';
import { Status } from '../mastodon/types';

// With Autoplay on, one post's video or GIF plays inline at a time: the first one well in view in
// the list that last scrolled. A module-level value, not a context, so every list shares it.
let active: string | null = null;
const listeners = new Set<() => void>();

export const setAutoplayPost = (id: string | null) => {
    if (id === active) return;
    active = id;
    listeners.forEach(listener => listener());
};

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

// Only the cards whose answer changes re-render
export const useIsAutoplayPost = (id: string) => useSyncExternalStore(subscribe, () => active === id);

const PLAYABLE = new Set(['video', 'gifv']);

// List rows are statuses or wrap one (thread rows, search results)
const playableId = (item: unknown): string | null => {
    const row = item as { status?: Status } & Partial<Status>;
    const status = (row?.status ?? row) as Partial<Status> | undefined;
    const target = status?.reblog ?? status;
    return target?.id && target.media_attachments?.some(a => PLAYABLE.has(a.type)) ? target.id : null;
};

// Spread into a FlashList of posts. Stable, as FlashList wants.
export const autoplayViewability = {
    viewabilityConfig: { itemVisiblePercentThreshold: 60 },
    onViewableItemsChanged: ({ viewableItems }: { viewableItems: ViewToken<unknown>[] }) => {
        const first = viewableItems.map(token => playableId(token.item)).find(Boolean);
        setAutoplayPost(first ?? null);
    },
};
