import React, { createContext, useContext, useState, useEffect } from 'react';
import { getCurrentAccount } from './mastodon/accounts';
import { Account } from './mastodon/types';
import { getCredentials, clearCredentials, saveCredentials, getSavedAccounts, addSavedAccount, removeSavedAccount, SavedAccount } from './storage';

interface AuthContextType {
    user: Account | null;
    loading: boolean;
    login: (user: Account, token?: string, instanceUrl?: string) => void;
    logout: (accountIdToLogout?: string | any) => Promise<void>;
    checkLoginStatus: () => Promise<void>;
    savedAccounts: SavedAccount[];
    switchAccount: (accountId: string) => Promise<void>;
    isAddingAccount: boolean;
    setAddingAccount: (val: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<Account | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
    const [isAddingAccount, setAddingAccount] = useState<boolean>(false);

    const checkLoginStatus = async () => {
        try {
            const accounts = await getSavedAccounts();
            setSavedAccounts(accounts);
            
            const credentials = await getCredentials();
            if (credentials.accessToken && credentials.instanceUrl) {
                const account = await getCurrentAccount();
                setUser(account);
            }
        } catch (error) {
            console.error('Failed to login, status: ', error);
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkLoginStatus();
    }, []);

    const login = (newUser: Account, token?: string, instanceUrl?: string) => {
        setUser(newUser);
        setAddingAccount(false);
        if (token && instanceUrl) {
            addSavedAccount(token, instanceUrl, newUser).then(() => {
                getSavedAccounts().then(setSavedAccounts);
            });
        }
    }

    const switchAccount = async (accountId: string) => {
        setLoading(true);
        try {
            const accounts = await getSavedAccounts();
            const target = accounts.find(a => a.id === accountId);
            if (target) {
                await saveCredentials(target.accessToken, target.instanceUrl);
                const account = await getCurrentAccount();
                setUser(account);
                setAddingAccount(false);
            }
        } catch (error) {
            console.error('Error switching account:', error);
        } finally {
            setLoading(false);
        }
    }

    const logout = async (accountIdToLogout?: string | any) => {
        const cleanAccountId = typeof accountIdToLogout === 'string' ? accountIdToLogout : undefined;
        setLoading(true);
        try {
            const currentCreds = await getCredentials();
            const activeId = user && currentCreds.instanceUrl ? `${user.acct}@${currentCreds.instanceUrl}` : null;
            const idToRemove = cleanAccountId || activeId;

            if (idToRemove) {
                await removeSavedAccount(idToRemove);
                const remaining = await getSavedAccounts();
                setSavedAccounts(remaining);

                if (idToRemove === activeId) {
                    if (remaining.length > 0) {
                        // Switch to next available account
                        await switchAccount(remaining[0].id);
                        return; // Switch account handles loading state
                    } else {
                        // No accounts left, fully logout
                        await clearCredentials();
                        setUser(null);
                    }
                }
            } else {
                await clearCredentials();
                setUser(null);
            }
        } catch (error) {
            console.error('Error logging out. Status: ', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, checkLoginStatus, savedAccounts, switchAccount, isAddingAccount, setAddingAccount }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}