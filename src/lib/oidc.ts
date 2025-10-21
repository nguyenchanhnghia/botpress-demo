import * as jose from 'jose';

export interface VerifyResult {
  header: jose.JWTHeaderParameters;
  claims: jose.JWTPayload;
}

export async function getOpenIdConfiguration(issuer: string): Promise<{ token_endpoint: string; jwks_uri: string; }> {
  const wellKnownUrl = new URL(`${issuer}/.well-known/openid-configuration`);
  const res = await fetch(wellKnownUrl.toString(), { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to fetch OIDC discovery: ${res.status}`);
  }
  const json = await res.json();
  if (!json.token_endpoint || !json.jwks_uri) {
    throw new Error('OIDC discovery missing token_endpoint or jwks_uri');
  }
  return { token_endpoint: json.token_endpoint, jwks_uri: json.jwks_uri };
}

export function createRemoteJwks(issuer: string) {
  const jwksUrl = new URL(`${issuer}/.well-known/jwks.json`);
  return jose.createRemoteJWKSet(jwksUrl);
}

export async function verifyIdToken(idToken: string, issuer: string, audience: string, expectedNonce?: string): Promise<VerifyResult> {
  const jwks = createRemoteJwks(issuer);
  const { payload, protectedHeader } = await jose.jwtVerify(idToken, jwks, {
    issuer,
    audience,
    clockTolerance: 5
  });

  if (expectedNonce && payload.nonce !== expectedNonce) {
    throw new Error('nonce_mismatch');
  }

  return { header: protectedHeader, claims: payload };
}

export async function exchangeCodeForTokens(params: {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
  codeVerifier?: string;
}): Promise<{ access_token?: string; id_token?: string; refresh_token?: string; token_type?: string; expires_in?: number; raw: any; }> {
  const { issuer, clientId, clientSecret, redirectUri, code, codeVerifier } = params;
  const { token_endpoint } = await getOpenIdConfiguration(issuer);

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId
  });
  if (clientSecret) body.set('client_secret', clientSecret);
  if (codeVerifier) body.set('code_verifier', codeVerifier);

  const res = await fetch(token_endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body.toString()
  });

  const json = await res.json();
  if (!res.ok) {
    const message = typeof json === 'object' ? JSON.stringify(json) : String(json);
    throw new Error(`Token exchange failed: ${res.status} ${message}`);
  }

  return {
    access_token: json.access_token,
    id_token: json.id_token,
    refresh_token: json.refresh_token,
    token_type: json.token_type,
    expires_in: json.expires_in,
    raw: json
  };
}



