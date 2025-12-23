import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, verifyIdToken } from '@/lib/oidc';
import Users from '@/lib/aws/users';

// Botpress cloud base (fallback to the same host used elsewhere in the project)
const BOTPRESS_BASE_URL = process.env.BOTPRESS_BASE_URL || 'https://chat.botpress.cloud/6e333992-4bc2-452f-9089-990386321bf5';

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
      console.error('[callback] missing id_token after exchange', tokens?.raw || null);
      return NextResponse.json({ error: 'missing_id_token', tokens: tokens.raw }, { status: 502 });
    }

    // Verify the ID token via issuer JWKS
    const verification = await verifyIdToken(tokens.id_token, OIDC_ISSUER, OIDC_CLIENT_ID, expectedNonce);

    // Get the user info from the dynamoDB if empty create the new user and create new user in the botpress system


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

    // Look up or create user record in DynamoDB and create a Botpress user when possible.
    let dbUser: any = null;
    let xUserKey: string | undefined = undefined;

    try {
      if (user.email) {
        dbUser = await Users.findByEmail(user.email);
      }

      if (dbUser) {
        // If user exists in DB, prefer an existing key
        xUserKey = dbUser.key || dbUser.userKey || dbUser.botpressKey;
      } else {
        // Create Botpress user first to obtain the authoritative key
        const DEFAULT_BOTPRESS_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZlMzMzOTkyLTRiYzItNDUyZi05MDg5LTk5MDM4NjMyMWJmNSIsImlhdCI6MTc2MjIyOTA5MX0.mczVeAPje72yHpPUgp3WngolqcubiQkKOVcPN69DtL8';
        let remoteKey: string | undefined;

        try {
          const serviceKey = process.env.BOTPRESS_SERVICE_KEY || process.env.BOTPRESS_TOKEN;
          if (serviceKey) {
            const bpResp = await fetch(`${BOTPRESS_BASE_URL}/users/get-or-create`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-user-key': serviceKey
              },
              body: JSON.stringify({
                name: user.displayName || user.email,
                pictureUrl: '',
                profile: JSON.stringify({ sub: user.sub, email: user.email, title: user.title, department: user.department })
              })
            });


            if (bpResp.ok) {
              const bpData = await bpResp.json();
              remoteKey = bpData?.key || bpData?.userKey || bpData?.xUserKey || bpData?.token || bpData?.id;
              // create DB entry with botpress response
              const created = await Users.create({
                email: user.email,
                displayName: user.displayName,
                sub: user.sub,
                key: remoteKey || DEFAULT_BOTPRESS_KEY,
                botpressResponse: bpData,
                createdAt: new Date().toISOString(),
                department: user.department,
                title: user.title
              });
              dbUser = created;
              xUserKey = remoteKey || DEFAULT_BOTPRESS_KEY;
            } else {
              // Botpress returned error — still create a DB record with default key and store error body
              const txt = await bpResp.text().catch(() => '');
              const created = await Users.create({
                email: user.email,
                displayName: user.displayName,
                sub: user.sub,
                key: DEFAULT_BOTPRESS_KEY,
                botpressError: `status:${bpResp.status} body:${txt}`,
                createdAt: new Date().toISOString()
              });
              dbUser = created;
              xUserKey = DEFAULT_BOTPRESS_KEY;
            }
          } else {
            // No server botpress token configured — create DB record with default key
            const created = await Users.create({
              email: user.email,
              displayName: user.displayName,
              sub: user.sub,
              key: DEFAULT_BOTPRESS_KEY,
              createdAt: new Date().toISOString()
            });
            dbUser = created;
            xUserKey = DEFAULT_BOTPRESS_KEY;
          }
        } catch (bpErr) {
          // On error, create DB record with default key and record error
          try {
            const created = await Users.create({
              email: user.email,
              displayName: user.displayName,
              sub: user.sub,
              key: DEFAULT_BOTPRESS_KEY,
              botpressError: (bpErr as Error).message,
              createdAt: new Date().toISOString()
            });
            dbUser = created;
            xUserKey = DEFAULT_BOTPRESS_KEY;
          } catch (dbErr2) {
            console.warn('[callback] Failed to create user after botpress error:', dbErr2);
          }
        }
      }
    } catch (dbErr) {
      console.warn('[callback] User lookup/create error:', dbErr);
    }

    // Update readable user_data cookie to include the x-user-key for client-side usage
    const userDataForCookie = { ...user, key: xUserKey };
    res.cookies.set('user_data', JSON.stringify(userDataForCookie), {
      httpOnly: false,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: tokens.expires_in ? tokens.expires_in : 60 * 60
    });

    // Set x-user-key cookie (from DB or Botpress response). Fallback to a generated value if missing.
    const finalUserKey = xUserKey || dbUser?.key || 'anonymous';
    res.cookies.set('x-user-key', finalUserKey, {
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



