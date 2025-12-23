// Re-export LDAP authentication functions
export { ldapAuth, auth, botpressAPI } from './ldap-auth';
import { auth as _auth } from './ldap-auth';

// local binding used by legacy functions
const auth = _auth;
export type { LDAPUser as User } from './ldap-auth';

// Legacy compatibility functions
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const authenticateUser = async (_username: string, _password: string): Promise<{ user: any; token: string } | null> => {
    // Redirect to LDAP login instead of direct authentication
    if (typeof window !== 'undefined') {
        const { ldapAuth } = await import('./ldap-auth');
        const url = await ldapAuth.getAuthorizationUrl();
        window.location.href = url;
    }
    return null;
};

// Flag to prevent multiple simultaneous clear operations
let isClearingAuth = false;

/**
 * Comprehensive function to clear all authentication data
 * Clears cookies, storage, and calls logout API
 */
export const clearAllAuthData = async (): Promise<void> => {
    if (typeof window === 'undefined') return;

    // Prevent multiple simultaneous clear operations
    if (isClearingAuth) {
        console.warn('clearAllAuthData already in progress, skipping');
        return;
    }

    isClearingAuth = true;

    try {
        // Don't call logout API if we're already on login page (prevents loop)
        const currentPath = window.location.pathname;
        if (currentPath !== '/login' && currentPath !== '/api/auth/callback') {
            try {
                // Call logout API to clear server-side cookies (httpOnly cookies)
                await fetch('/api/auth/logout', {
                    method: 'POST',
                    credentials: 'include',
                }).catch(() => {
                    // Ignore errors - we'll clear client-side anyway
                });
            } catch (error) {
                console.error('Error calling logout API:', error);
            }
        }
    } finally {
        // Always clear client-side, even if API call fails
        // Clear client-side cookies
        auth.logout();

        // Clear all possible cookies manually (in case some weren't caught)
        const cookieNames = [
            'auth_token',
            'user_data',
            'x-user-key',
            'conversation_data',
            'pkce_code_verifier',
            'oidc_access_token',
            'oidc_nonce',
            'accessToken', // Legacy cookie name
        ];

        cookieNames.forEach(name => {
            // Remove with different path options to ensure complete removal
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname};`;
        });

        // Clear localStorage and sessionStorage
        try {
            localStorage.clear();
            sessionStorage.clear();
        } catch (e) {
            console.warn('Error clearing storage:', e);
        }

        // Reset flag after a short delay to allow redirect to happen
        setTimeout(() => {
            isClearingAuth = false;
        }, 1000);
    }
};

export const checkAuthStatus = async (): Promise<any | null> => {
    // Don't check auth status if we're on login or callback pages (prevents loops)
    if (typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        if (currentPath === '/login' || currentPath === '/api/auth/callback') {
            return null;
        }
    }

    try {
        const response = await fetch('/api/protected', {
            credentials: 'include', // Ensure cookies are sent
        });

        if (response.ok) {
            const data = await response.json();
            return data.user;
        }

        // Handle 401 Unauthorized - clear all auth data and redirect to login
        if (response.status === 401) {
            console.warn('Authentication failed (401), clearing all auth data and redirecting to login');
            if (typeof window !== 'undefined') {
                const currentPath = window.location.pathname;
                // Only redirect if not already on login page
                if (currentPath !== '/login' && currentPath !== '/api/auth/callback') {
                    // Clear all cookies and user data
                    await clearAllAuthData();
                    // Redirect to login
                    window.location.href = '/login';
                }
            }
            return null;
        }

        // Other errors
        console.error('Auth status check failed:', response.status, response.statusText);
        return null;
    } catch (error) {
        console.error('Auth status check error:', error);
        return null;
    }
};

export const logoutUser = async (): Promise<void> => {
    // Use the comprehensive clear function
    await clearAllAuthData();
};
