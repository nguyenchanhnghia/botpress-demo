import { NextRequest, NextResponse } from 'next/server';
import { ldapAuth } from '@/lib/ldap-auth.server';
import { serverRuntimeConfig } from '@/lib/runtime-config/server';
import Users from '@/lib/aws/users';

export interface AuthenticatedUser {
    sub: string;
    email?: string;
    department?: string;
    title?: string;
    displayName?: string;
    givenName?: string;
    /**
     * Role is stored in DynamoDB and is needed for admin UI gating.
     * For OIDC sessions, role is usually added by `/api/protected` (DynamoDB lookup).
     * For UAT email-login sessions, we include it directly from DynamoDB.
     */
    role?: string;
    /**
     * Botpress user key (if present in DynamoDB)
     */
    key?: string;
}

export async function requireAuth(req: NextRequest): Promise<AuthenticatedUser | NextResponse> {
    try {
        const isUat = (serverRuntimeConfig.appEnv || '').toLowerCase() === 'uat';

        // Get JWT token from cookie or Authorization header
        const token = req.cookies.get('auth_token')?.value
            || req.headers.get('authorization')?.replace('Bearer ', '');

        // UAT-only fallback: allow session from `user_data` cookie (set by /api/auth/uat-login)
        // This is intentionally limited to UAT environments.
        if (!token && isUat) {
            const rawUser = req.cookies.get('user_data')?.value;
            if (!rawUser) {
                return NextResponse.json({ error: 'Unauthorized - No access token' }, { status: 401 });
            }

            try {
                const parsed = JSON.parse(rawUser) as { email?: string; sub?: string };
                const email = (parsed.email || '').trim().toLowerCase();
                if (!email) {
                    return NextResponse.json({ error: 'Unauthorized - Missing email' }, { status: 401 });
                }

                // Always re-fetch from DynamoDB to avoid trusting stale/forged client cookie values
                const record = await Users.findByEmail(email);
                if (!record) {
                    return NextResponse.json({ error: 'Unauthorized - User not found' }, { status: 401 });
                }

                return {
                    sub: (record as any).sub || record.id || (record as any).user_id || email,
                    email: record.email || email,
                    department: (record as any).department,
                    title: (record as any).title,
                    displayName: record.displayName,
                    givenName: (record as any).givenName,
                    role: (record as any).role,
                    key: (record as any).key,
                };
            } catch {
                return NextResponse.json({ error: 'Unauthorized - Invalid user session' }, { status: 401 });
            }
        }

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized - No access token' }, { status: 401 });
        }

        // Check if token is expired
        if (ldapAuth.isTokenExpired(token)) {
            return NextResponse.json({ error: 'Unauthorized - Token expired' }, { status: 401 });
        }

        // Verify token and get user info
        const user = await ldapAuth.verifyToken(token);

        if (!user) {
            // UAT-only fallback if token verification fails but session cookie exists
            if (isUat) {
                const rawUser = req.cookies.get('user_data')?.value;
                if (rawUser) {
                    try {
                        const parsed = JSON.parse(rawUser) as { email?: string };
                        const email = (parsed.email || '').trim().toLowerCase();
                        if (email) {
                            const record = await Users.findByEmail(email);
                            if (record) {
                                return {
                                    sub: (record as any).sub || record.id || (record as any).user_id || email,
                                    email: record.email || email,
                                    department: (record as any).department,
                                    title: (record as any).title,
                                    displayName: record.displayName,
                                    givenName: (record as any).givenName,
                                    role: (record as any).role,
                                    key: (record as any).key,
                                };
                            }
                        }
                    } catch {
                        // ignore and fall through
                    }
                }
            }
            return NextResponse.json({ error: 'Unauthorized - Invalid access token' }, { status: 401 });
        }

        return {
            sub: user.sub,
            email: user.email,
            department: user.department,
            title: user.title,
            displayName: user.displayName,
        };
    } catch (error) {
        console.error('Auth middleware error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function optionalAuth(req: NextRequest): Promise<AuthenticatedUser | null> {
    try {
        const isUat = (serverRuntimeConfig.appEnv || '').toLowerCase() === 'uat';

        const token = req.cookies.get('auth_token')?.value
            || req.headers.get('authorization')?.replace('Bearer ', '');

        if (!token && isUat) {
            const rawUser = req.cookies.get('user_data')?.value;
            if (!rawUser) return null;
            try {
                const parsed = JSON.parse(rawUser) as { email?: string };
                const email = (parsed.email || '').trim().toLowerCase();
                if (!email) return null;
                const record = await Users.findByEmail(email);
                if (!record) return null;
                return {
                    sub: (record as any).sub || record.id || (record as any).user_id || email,
                    email: record.email || email,
                    department: (record as any).department,
                    title: (record as any).title,
                    displayName: record.displayName,
                    givenName: (record as any).givenName,
                    role: (record as any).role,
                    key: (record as any).key,
                };
            } catch {
                return null;
            }
        }

        if (!token) {
            return null;
        }

        // Check if token is expired
        if (ldapAuth.isTokenExpired(token)) {
            return null;
        }

        const user = await ldapAuth.verifyToken(token);

        if (!user) {
            return null;
        }

        return {
            sub: user.sub,
            email: user.email,
            department: user.department,
            title: user.title,
            displayName: user.displayName,
            givenName: user.givenName,
        };
    } catch (error) {
        console.error('Optional auth error:', error);
        return null;
    }
}