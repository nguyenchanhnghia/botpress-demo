import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, verifyIdToken } from '@/lib/oidc';

// Expected environment variables
const OIDC_ISSUER = process.env.OIDC_ISSUER || 'http://localhost:3000';
const OIDC_CLIENT_ID = process.env.OIDC_CLIENT_ID || 'third-party-web';
const OIDC_CLIENT_SECRET = process.env.OIDC_CLIENT_SECRET || '';
const OIDC_REDIRECT_URI = process.env.OIDC_REDIRECT_URI || 'http://localhost:4000/callback';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code') || '';
    const state = searchParams.get('state') || undefined;

    if (!code) {
      return NextResponse.json({ error: 'missing_code' }, { status: 400 });
    }

    // PKCE code_verifier and state/nonce could be stored in cookies; read if present
    const codeVerifier = req.cookies.get('pkce_code_verifier')?.value;
    const expectedNonce = req.cookies.get('oidc_nonce')?.value;

    // Exchange authorization code for tokens
    const tokens = await exchangeCodeForTokens({
      issuer: OIDC_ISSUER,
      clientId: OIDC_CLIENT_ID,
      clientSecret: OIDC_CLIENT_SECRET,
      redirectUri: OIDC_REDIRECT_URI,
      code,
      codeVerifier
    });

    if (!tokens.id_token) {
      return NextResponse.json({ error: 'missing_id_token', tokens: tokens.raw }, { status: 502 });
    }

    // Verify the ID token via issuer JWKS
    const verification = await verifyIdToken(tokens.id_token, OIDC_ISSUER, OIDC_CLIENT_ID, expectedNonce);

    // Optionally, set a session cookie with access token
    const res = NextResponse.json({
      success: true,
      state,
      header: verification.header,
      claims: verification.claims
    });

    // Build user object from verified claims (mirror ldap-auth's LDAPUser shape)
    const user = {
      sub: verification.claims.sub as string,
      email: verification.claims.email as string | undefined,
      department: verification.claims.department as string | undefined,
      title: verification.claims.title as string | undefined,
      displayName: (verification.claims.displayName || verification.claims.name) as string | undefined
    };

    // Set auth_token (httpOnly) and user_data (readable) cookies so client-side code can detect login
    if (tokens.id_token) {
      res.cookies.set('auth_token', tokens.id_token, {
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: tokens.expires_in ? tokens.expires_in : 60 * 60
      });
    }

    res.cookies.set('user_data', JSON.stringify(user), {
      httpOnly: false,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: tokens.expires_in ? tokens.expires_in : 60 * 60
    });

    // Set x-user-key cookie as used by Botpress integration (same static example token used elsewhere)
    res.cookies.set('x-user-key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjljMWI1ODViLWIxOWUtNGMwNy1iYTQ4LWNiZjUzYjJjYjZlOCIsImlhdCI6MTc2MTA0NDc0OH0.3tVt0zkrYH5SAuAxEdynXPprq38TRfUSngm2pTBjucw', {
      httpOnly: false,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: tokens.expires_in ? tokens.expires_in : 60 * 60 * 24 * 7
    });

    // Example: set access token in HTTP-only cookie if desired
    if (tokens.access_token) {
      res.cookies.set('oidc_access_token', tokens.access_token, {
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: tokens.expires_in ? tokens.expires_in : 3600
      });
    }

    return res;
  } catch (error: any) {
    const message = error?.message || 'callback_error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}



