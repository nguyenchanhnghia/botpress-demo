import { NextRequest, NextResponse } from 'next/server';
import { ldapAuth } from '@/lib/ldap-auth';

export interface AuthenticatedUser {
    sub: string;
    email?: string;
    department?: string;
    title?: string;
    displayName?: string;
}

export async function requireAuth(req: NextRequest): Promise<AuthenticatedUser | NextResponse> {
    try {
        // Get JWT token from cookie or Authorization header
        const token = req.cookies.get('auth_token')?.value
            || req.headers.get('authorization')?.replace('Bearer ', '');

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
        const token = req.cookies.get('auth_token')?.value
            || req.headers.get('authorization')?.replace('Bearer ', '');

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
            displayName: user.displayName
        };
    } catch (error) {
        console.error('Optional auth error:', error);
        return null;
    }
}