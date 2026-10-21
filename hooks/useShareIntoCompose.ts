import { useEffect, useRef } from 'react';
import { ResolvedSharePayload, useIncomingShare } from 'expo-sharing';
import { useCompose } from '../services/composeContext';
import { sharedContent } from '../services/sharedContent';

// pugdon in the system share sheet: what another app shares starts a post, once you're signed in
export const useShareIntoCompose = (signedIn: boolean) => {
    const { resolvedSharedPayloads, clearSharedPayloads } = useIncomingShare();
    const { openCompose } = useCompose();
    // The share already turned into a post, so a re-render or signing in again doesn't open it twice
    const handled = useRef<ResolvedSharePayload[] | null>(null);

    useEffect(() => {
        if (!signedIn || resolvedSharedPayloads.length === 0 || handled.current === resolvedSharedPayloads) return;
        handled.current = resolvedSharedPayloads;
        sharedContent(resolvedSharedPayloads)
            .then(shared => openCompose({ shared }))
            .catch(error => console.warn('Reading what was shared failed:', error));
        clearSharedPayloads();
    }, [signedIn, resolvedSharedPayloads, openCompose, clearSharedPayloads]);
};
