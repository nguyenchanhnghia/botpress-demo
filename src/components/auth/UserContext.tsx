"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { checkAuthStatus } from '@/lib/auth';
import { initPublicRuntimeConfig } from '@/lib/runtime-config/public';

export interface UserContextType {
    user: any;
    setUser: (user: any) => void;
    loading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const pathname = usePathname();

    useEffect(() => {
        // Don't check auth on login pages (prevents loops), but DO re-check when navigating away.
        // Using pathname ensures this effect reruns after a successful login redirect.
        const currentPath = pathname || (typeof window !== 'undefined' ? window.location.pathname : '');
        if (currentPath === '/login' || currentPath === '/login-uat' || currentPath === '/api/auth/callback') {
            setUser(null);
            setLoading(false);
            return;
        }

        const fetchUser = async () => {
            try {
                setLoading(true);
                const userData = await checkAuthStatus();

                // checkAuthStatus will handle 401 redirects internally and clear all data
                // If we get here and userData is null, it might be a different error
                // or the redirect is in progress
                setUser(userData);

                // After login succeeds, load runtime config (protected endpoint) once and cache it.
                if (userData) {
                    initPublicRuntimeConfig().catch((err) => {
                        console.warn('[UserContext] Failed to init runtime config:', err);
                    });
                }

                // Console log user info from UserContext
                if (userData) {
                    console.log('[UserContext] User data loaded:', {
                        email: userData.email,
                        displayName: userData.displayName,
                        role: userData.role,
                        department: userData.department,
                        title: userData.title,
                        fullUser: userData
                    });
                }

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
    }, [pathname]);

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