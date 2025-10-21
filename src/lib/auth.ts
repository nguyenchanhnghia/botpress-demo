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

export const checkAuthStatus = async (): Promise<any | null> => {
    try {
        const response = await fetch('/api/protected');
        if (response.ok) {
            const data = await response.json();
            return data.user;
        }
        return null;
    } catch (error) {
        console.error('Auth status check error:', error);
        return null;
    }
};

export const logoutUser = async (): Promise<void> => {
    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
        });
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        // Always clear client-side state
        auth.logout();
    }
};
