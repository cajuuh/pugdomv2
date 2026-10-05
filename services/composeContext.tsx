import React, { createContext, useContext, useState } from 'react';
import { Status } from './mastodon/types';
import ComposeModal from '../components/ComposeModal/composeModal';

interface ComposeContextType {
    isOpen: boolean;
    replyToStatus: Status | null;
    // The post being quoted (Mastodon 4.5)
    quoteStatus: Status | null;
    openCompose: (params?: { replyToStatus?: Status; quoteStatus?: Status }) => void;
    closeCompose: () => void;
}

const ComposeContext = createContext<ComposeContextType | undefined>(undefined);

export const ComposeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [replyToStatus, setReplyToStatus] = useState<Status | null>(null);
    const [quoteStatus, setQuoteStatus] = useState<Status | null>(null);

    const openCompose = (params?: { replyToStatus?: Status; quoteStatus?: Status }) => {
        setReplyToStatus(params?.replyToStatus ?? null);
        setQuoteStatus(params?.quoteStatus ?? null);
        setIsOpen(true);
    };

    const closeCompose = () => {
        setIsOpen(false);
        setReplyToStatus(null);
        setQuoteStatus(null);
    };

    return (
        <ComposeContext.Provider value={{ isOpen, replyToStatus, quoteStatus, openCompose, closeCompose }}>
            {children}
            <ComposeModal isOpen={isOpen} replyToStatus={replyToStatus} quoteStatus={quoteStatus} closeCompose={closeCompose} />
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
