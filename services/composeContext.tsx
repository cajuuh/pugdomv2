import React, { createContext, useContext, useRef, useState } from 'react';
import { Status } from './mastodon/types';
import { SharedContent } from './sharedContent';
import ComposeModal from '../components/ComposeModal/composeModal';

interface ComposeContextType {
    isOpen: boolean;
    replyToStatus: Status | null;
    // The post being quoted (Mastodon 4.5)
    quoteStatus: Status | null;
    // One of your posts being edited, or redrafted after deleting it
    existingPost: ExistingPost | null;
    // Text and media another app shared with pugdon
    shared: SharedContent | null;
    openCompose: (params?: ComposeParams) => void;
    closeCompose: () => void;
}

// Editing keeps the post (PUT); redrafting got it back from the delete and posts it anew
export interface ExistingPost {
    mode: 'edit' | 'redraft';
    status: Status;
}

interface ComposeParams {
    replyToStatus?: Status;
    quoteStatus?: Status;
    existingPost?: ExistingPost;
    shared?: SharedContent;
}

const ComposeContext = createContext<ComposeContextType | undefined>(undefined);

export const ComposeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [replyToStatus, setReplyToStatus] = useState<Status | null>(null);
    const [quoteStatus, setQuoteStatus] = useState<Status | null>(null);
    const [existingPost, setExistingPost] = useState<ExistingPost | null>(null);
    const [shared, setShared] = useState<SharedContent | null>(null);
    // Shared while compose was already open, to add to the draft
    const [incoming, setIncoming] = useState<SharedContent | null>(null);
    const open = useRef(false);

    const openCompose = (params?: ComposeParams) => {
        // A share while composing joins the draft instead of replacing it: keyboards that can't put a GIF
        // or sticker into the text field share it with the app instead
        if (open.current && params?.shared && !params.replyToStatus && !params.quoteStatus && !params.existingPost) {
            setIncoming(params.shared);
            return;
        }
        open.current = true;
        setReplyToStatus(params?.replyToStatus ?? null);
        setQuoteStatus(params?.quoteStatus ?? null);
        setExistingPost(params?.existingPost ?? null);
        setShared(params?.shared ?? null);
        setIncoming(null);
        setIsOpen(true);
    };

    const closeCompose = () => {
        open.current = false;
        setIsOpen(false);
        setReplyToStatus(null);
        setQuoteStatus(null);
        setExistingPost(null);
        setShared(null);
        setIncoming(null);
    };

    return (
        <ComposeContext.Provider value={{ isOpen, replyToStatus, quoteStatus, existingPost, shared, openCompose, closeCompose }}>
            {children}
            <ComposeModal
                isOpen={isOpen}
                replyToStatus={replyToStatus}
                quoteStatus={quoteStatus}
                existingPost={existingPost}
                shared={shared}
                incoming={incoming}
                closeCompose={closeCompose}
            />
        </ComposeContext.Provider>
    );
};

export const useCompose = () => {
    const context = useContext(ComposeContext);
    if (!context) {
        throw new Error('useCompose must be used within a ComposeProvider');
    }
    return context;
};
