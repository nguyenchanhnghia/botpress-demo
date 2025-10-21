"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { checkAuthStatus } from '@/lib/auth';

export interface UserContextType {
    user: any;
    setUser: (user: any) => void;
    loading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkAuthStatus().then(u => {
            setUser(u);
            setLoading(false);
        });
    }, []);

    return (
        <UserContext.Provider value={{ user, setUser, loading }}>
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    const ctx = useContext(UserContext);
    console.log(ctx);
    if (!ctx) throw new Error('useUser must be used within a UserProvider');
    return ctx;
} 