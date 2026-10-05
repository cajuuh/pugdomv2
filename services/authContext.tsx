import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Alert, DeviceEventEmitter } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { UNAUTHORIZED_EVENT } from './api/client';
import { getCurrentAccount } from './mastodon/accounts';
import { Account } from './mastodon/types';
import { getCredentials, clearCredentials, saveCredentials, getSavedAccounts, addSavedAccount, removeSavedAccount, SavedAccount } from './storage';
import { useI18n } from './i18n/i18nContext';

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
    // True right after logging in (or adding an account), until the setup screen is done
    needsSetup: boolean;
    finishSetup: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<Account | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
    const [isAddingAccount, setAddingAccount] = useState<boolean>(false);
    const [needsSetup, setNeedsSetup] = useState<boolean>(false);
    const queryClient = useQueryClient();
    const { t } = useI18n();
    // Tokens already handled, so a burst of 401s from one token only logs out once
    const handledUnauthorizedTokens = useRef(new Set<string>());

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

    // Cached timelines etc. belong to the previous account, so drop them (and any in-flight
    // fetches that would repopulate them) whenever the active account changes
    const resetServerState = () => {
        queryClient.cancelQueries();
        queryClient.clear();
    };

    const login = (newUser: Account, token?: string, instanceUrl?: string) => {
        resetServerState();
        setUser(newUser);
        setAddingAccount(false);
        setNeedsSetup(true);
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
                resetServerState();
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
            // Resolve the active account from storage, so this also works before `user` is loaded
            const currentCreds = await getCredentials();
            const accounts = await getSavedAccounts();
            const activeId = accounts.find(a => a.accessToken === currentCreds.accessToken)?.id ?? null;
            const idToRemove = cleanAccountId || activeId;

            let remaining = accounts;
            if (idToRemove) {
                await removeSavedAccount(idToRemove);
                remaining = await getSavedAccounts();
                setSavedAccounts(remaining);
            }

            if (!idToRemove || idToRemove === activeId) {
                if (remaining.length > 0) {
                    // Switch to next available account
                    await switchAccount(remaining[0].id);
                    return; // Switch account handles loading state
                } else {
                    // No accounts left, fully logout
                    await clearCredentials();
                    resetServerState();
                    setUser(null);
                }
            }
        } catch (error) {
            console.error('Error logging out. Status: ', error);
        } finally {
            setLoading(false);
        }
    };

    // Drop the account whose token the active instance rejected (revoked or expired)
    const handleUnauthorized = async (accessToken: string) => {
        if (handledUnauthorizedTokens.current.has(accessToken)) {
            return;
        }
        const currentCreds = await getCredentials();
        // Ignore late 401s from an account we already switched away from
        if (currentCreds.accessToken !== accessToken || handledUnauthorizedTokens.current.has(accessToken)) {
            return;
        }
        handledUnauthorizedTokens.current.add(accessToken);

        const accounts = await getSavedAccounts();
        const expired = accounts.find(a => a.accessToken === accessToken);
        Alert.alert(
            t('auth.sessionExpired'),
            expired
                ? t('auth.logInAgainTo', { acct: expired.userInfo.acct })
                : t('auth.logInAgain')
        );
        await logout(expired?.id);
    };

    const handleUnauthorizedRef = useRef(handleUnauthorized);
    handleUnauthorizedRef.current = handleUnauthorized;

    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener(UNAUTHORIZED_EVENT, ({ accessToken }: { accessToken: string }) => {
            handleUnauthorizedRef.current(accessToken);
        });
        return () => subscription.remove();
    }, []);

    return (
        <AuthContext.Provider value={{
                user,
                loading,
                login,
                logout,
                checkLoginStatus,
                savedAccounts,
                switchAccount,
                isAddingAccount,
                setAddingAccount,
                needsSetup,
                finishSetup: () => setNeedsSetup(false),
            }}>
            {children}
        </AuthContext.Provider>
    );
};

// For components that also render outside the provider (tests, previews): null there
export const useOptionalAuth = () => useContext(AuthContext) ?? null;

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}