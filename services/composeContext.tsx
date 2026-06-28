import React, { createContext, useContext, useState } from 'react';
import { Status } from './mastodon/types';
import ComposeModal from '../components/ComposeModal/composeModal';

interface ComposeContextType {
    isOpen: boolean;
    replyToStatus: Status | null;
    openCompose: (params?: { replyToStatus?: Status }) => void;
    closeCompose: () => void;
}

const ComposeContext = createContext<ComposeContextType | undefined>(undefined);

export const ComposeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [replyToStatus, setReplyToStatus] = useState<Status | null>(null);

    const openCompose = (params?: { replyToStatus?: Status }) => {
        if (params?.replyToStatus) {
            setReplyToStatus(params.replyToStatus);
        } else {
            setReplyToStatus(null);
        }
        setIsOpen(true);
    };

    const closeCompose = () => {
        setIsOpen(false);
        setReplyToStatus(null);
    };

    return (
        <ComposeContext.Provider value={{ isOpen, replyToStatus, openCompose, closeCompose }}>
            {children}
            <ComposeModal />
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
