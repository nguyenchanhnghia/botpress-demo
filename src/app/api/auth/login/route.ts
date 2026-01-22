import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { serverRuntimeConfig } from '@/lib/runtime-config/server';

function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function generateRandomString(bytes: number): string {
  return base64UrlEncode(crypto.randomBytes(bytes));
}

function sha256Base64Url(input: string): string {
  const digest = crypto.createHash('sha256').update(input).digest();
  return base64UrlEncode(digest);
}

/**
 * Starts the OAuth/OIDC login flow server-side.
 * - Generates PKCE verifier/challenge
 * - Stores verifier in an HttpOnly cookie for the callback route
 * - Redirects to the IdP authorize endpoint
 */
export async function GET() {
  const cfg = serverRuntimeConfig;

  const codeVerifier = generateRandomString(32);
  const codeChallenge = sha256Base64Url(codeVerifier);

  const state = generateRandomString(16);
  const nonce = generateRandomString(16);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    scope: 'openid email profile',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    nonce,
  });

  const authorizeUrl = `${cfg.ldapAuthUrl}/authorize?${params.toString()}`;

  const res = NextResponse.redirect(authorizeUrl);
  res.cookies.set('pkce_code_verifier', codeVerifier, {
    httpOnly: true,
    secure: cfg.cookieConfig.secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10, // 10 minutes
  });

  return res;
}

