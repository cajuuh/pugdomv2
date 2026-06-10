import React, { createContext, useContext, useState, useEffect } from 'react';
import { getCurrentAccount } from './mastodon/accounts';
import { Account } from './mastodon/types';
import { getCredentials, clearCredentials } from './storage';

interface AuthContextType {
    user: Account | null;
    loading: boolean;
    login: (user: Account) => void;
    logout: () => Promise<void>;
    checkLoginStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<Account | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    const checkLoginStatus = async () => {
        try {
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

    const login = (newUser: Account) => {
        setUser(newUser);
    }

    const logout = async () => {
        setLoading(true);
        try {
            await clearCredentials();
            setUser(null);
        } catch (error) {
            console.error('Error logging out. Status: ', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, checkLoginStatus }}>
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