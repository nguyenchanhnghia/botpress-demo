import 'server-only';

import { jwtVerify, createRemoteJWKSet, decodeJwt } from 'jose';
import { serverRuntimeConfig } from '@/lib/runtime-config/server';

export interface LDAPUser {
  sub: string;
  email?: string;
  department?: string;
  title?: string;
  displayName?: string;
  givenName?: string;
  company?: string;
  role?: string;
}

function isTokenExpired(token: string): boolean {
  try {
    const [, payloadB64] = token.split('.');
    if (!payloadB64) return true;
    const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson) as { exp?: number };
    const now = Math.floor(Date.now() / 1000);
    return typeof payload.exp === 'number' ? payload.exp < now : true;
  } catch {
    return true;
  }
}

export const ldapAuth = {
  isTokenExpired,

  exchangeCodeForToken: async (
    code: string,
    codeVerifierFromServer?: string
  ): Promise<{ user: LDAPUser; token: string } | null> => {
    const cfg = serverRuntimeConfig;
    const codeVerifier = codeVerifierFromServer || null;
    if (!codeVerifier) {
      throw new Error('Code verifier not found');
    }

    const response = await fetch(`${cfg.ldapAuthUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: cfg.clientId,
        redirect_uri: cfg.redirectUri,
        code,
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({} as any));
      throw new Error(errorData.error_description || 'Token exchange failed');
    }

    const data = await response.json();

    const decoded = decodeJwt(data.id_token as string) as any;
    const tokenIssuer: string = decoded.iss || cfg.ldapAuthUrl;
    const jwksUrl = `${tokenIssuer.replace(/\/$/, '')}/.well-known/jwks.json`;
    const jwks = createRemoteJWKSet(new URL(jwksUrl));

    const { payload } = await jwtVerify(data.id_token, jwks, {
      audience: cfg.clientId,
      issuer: tokenIssuer,
    });

    const user: LDAPUser = {
      sub: payload.sub as string,
      email: payload.email as string,
      department: payload.department as string,
      title: payload.title as string,
      displayName: payload.displayName as string,
      givenName: payload.givenName as string,
      company: payload.company as string,
    };

    return { user, token: data.id_token };
  },

  verifyToken: async (token: string): Promise<LDAPUser | null> => {
    try {
      const cfg = serverRuntimeConfig;
      const decoded = decodeJwt(token as string) as any;
      const tokenIssuer: string = decoded.iss || cfg.ldapAuthUrl;
      const jwksUrl = `${tokenIssuer.replace(/\/$/, '')}/.well-known/jwks.json`;
      const jwks = createRemoteJWKSet(new URL(jwksUrl));

      const { payload } = await jwtVerify(token, jwks, {
        audience: cfg.clientId,
        issuer: tokenIssuer,
      });

      return {
        sub: payload.sub as string,
        email: payload.email as string,
        department: payload.department as string,
        title: payload.title as string,
        displayName: payload.displayName as string,
        givenName: payload.givenName as string,
        company: payload.company as string,
      };
    } catch (error) {
      console.error('Token verification error:', error);
      return null;
    }
  },
};

