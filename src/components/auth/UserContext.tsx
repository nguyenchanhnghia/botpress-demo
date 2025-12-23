"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
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
    const router = useRouter();

    useEffect(() => {
        // Don't check auth on login or callback pages (prevents loops)
        if (typeof window !== 'undefined') {
            const currentPath = window.location.pathname;
            if (currentPath === '/login' || currentPath === '/api/auth/callback') {
                setLoading(false);
                return;
            }
        }

        const fetchUser = async () => {
            try {
                const userData = await checkAuthStatus();

                // checkAuthStatus will handle 401 redirects internally and clear all data
                // If we get here and userData is null, it might be a different error
                // or the redirect is in progress
                setUser(userData);

                // Clear user state if no user data (ensures UserContext is cleared)
                if (!userData) {
                    setUser(null);
                }

                // Don't redirect here - let checkAuthStatus handle it to prevent loops
                // Only set loading to false
            } catch (error) {
                console.error('Error fetching user:', error);
                setUser(null);
                // Don't redirect on error - checkAuthStatus already handles 401 redirects
                // Network errors shouldn't trigger redirects
            } finally {
                setLoading(false);
            }
        };

        fetchUser();
    }, [router]);

    return (
        <UserContext.Provider value={{ user, setUser, loading }}>
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    const ctx = useContext(UserContext);
    if (!ctx) throw new Error('useUser must be used within a UserProvider');
    return ctx;
} 