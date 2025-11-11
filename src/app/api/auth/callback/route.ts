import { NextRequest, NextResponse } from 'next/server';
import { ldapAuth } from '@/lib/ldap-auth';
import { config } from '@/lib/config';
import Users from '@/lib/aws/users';

/**
 * OAuth callback handler (server API route)
 *
 * Purpose:
 * - Process the authorization code returned by the identity provider (OIDC / LDAP provider).
 * - Exchange the code for tokens using ldapAuth.exchangeCodeForToken (server-side PKCE verifier is read
 *   from a cookie `pkce_code_verifier`).
 * - Verify the ID token and build a minimal user object from verified claims.
 * - Persist or lookup the user in DynamoDB (via `Users` helper). If not found in DB, call Botpress
 *   `/users/get-or-create` first to obtain the canonical Botpress user key, then create the DB record
 *   using that key. If Botpress is unavailable or the request fails, fall back to a default static key.
 * - Set cookies for the client:
 *     - `auth_token` (HttpOnly) : the ID token for server-side checks (short-lived)
 *     - `user_data` (readable) : JSON representation of the user for client-side UI
 *     - `x-user-key` (readable) : Botpress user key used by client-side Botpress calls
 * - Redirect the browser to `/botChat` after successful handling.
 *
 * Important env variables used:
 * - BOTPRESS_API_USER_KEY (preferred) | BOTPRESS_SERVICE_KEY | BOTPRESS_TOKEN : service key used for calling
 *   Botpress `/users/get-or-create` on the server.
 * - USERS_TABLE, USERS_TABLE_PK, etc. are used by the Users helper to persist records.
 *
 * Notes:
 * - This is a server-side Next.js route (runs in Node). All console logs appear in the server terminal.
 * - The handler is defensive: when Dynamo is unavailable (expired AWS creds) it falls back to calling
 *   Botpress or using a default key so the login flow is not blocked.
 */
const BOTPRESS_BASE_URL = process.env.BOTPRESS_BASE_URL || 'https://chat.botpress.cloud/6e333992-4bc2-452f-9089-990386321bf5';


export async function GET(req: NextRequest) {
  try {
    // Parse redirect URL and extract OIDC parameters: authorization code and optional error
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(new URL('/login?error=oauth_error', process.env.NEXT_PUBLIC_APP_URL || 'https://wiki.vietjetthai.com'));
    }

    if (!code) {
      return NextResponse.redirect(new URL('/login?error=no_code', process.env.NEXT_PUBLIC_APP_URL || 'https://wiki.vietjetthai.com'));
    }

    // PKCE: read the code_verifier stored in a short-lived cookie during the initial authorization request
    // This allows the server-side callback to complete the PKCE exchange (sessionStorage is not available on server)
    const codeVerifier = req.cookies.get('pkce_code_verifier')?.value;

    try {
      // Exchange the authorization code for tokens using ldapAuth helper. We pass the server-side
      // PKCE verifier when available so the token endpoint can validate the PKCE flow.
      const result = await ldapAuth.exchangeCodeForToken(code, codeVerifier || undefined);

      if (result?.user) console.log('[api/callback] user claims:', {
        sub: result.user.sub,
        email: result.user.email,
        displayName: result.user.displayName,
        department: result.user.department,
        title: result.user.title
      });

      if (!result) {
        return NextResponse.redirect(new URL('/login?error=auth_failed', process.env.NEXT_PUBLIC_APP_URL || 'https://wiki.vietjetthai.com'));
      }

      const res = NextResponse.redirect(new URL('/botChat', process.env.NEXT_PUBLIC_APP_URL || 'https://wiki.vietjetthai.com'));


      res.cookies.set('auth_token', result.token, {
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
        secure: config.cookieConfig.secure,
        maxAge: 60 * 60 * 24 * config.cookieConfig.expires,
      });

      // Resolve Botpress user key then persist user to DynamoDB.
      // Flow:
      // 1. Try to find existing user in Dynamo by email.
      // 2. If not found, call Botpress `/users/get-or-create` using a server-side API key
      //    (BOTPRESS_API_USER_KEY preferred). Use the returned Botpress key as the user's key.
      // 3. Persist the user record with the Botpress key so future logins can find it locally.
      let dbUser: any = null;
      let xUserKey: string | undefined = undefined;
      const serviceKey = process.env.BOTPRESS_API_USER_KEY;

      try {
        // If the ID token includes an email, try the (fast) GSI query to locate the user in DynamoDB
        if (result.user?.email) {
          dbUser = await Users.findByEmail(result.user.email);
        }

        if (dbUser) {
          xUserKey = dbUser.key || serviceKey;
        } else {

          if (serviceKey) {
            // Call Botpress server API to create or fetch a user. The Botpress endpoint expects
            // an 'x-user-key' header and a body with name/pictureUrl/profile fields.
            const bpResp = await fetch(`${BOTPRESS_BASE_URL}/users/get-or-create`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-user-key': serviceKey
              },
              body: JSON.stringify({
                name: result.user?.displayName || result.user?.email,
                pictureUrl: '',
                profile: JSON.stringify({ sub: result.user?.sub, email: result.user?.email, title: result.user?.title, department: result.user?.department })
              })
            });

            if (!!bpResp?.ok) {
              const bpData = await bpResp.json();
              const remoteKey = bpData?.key || process.env.BOTPRESS_API_USER_KEY;
              // Persist the user into DynamoDB using the Botpress-provided key (or configured fallback).
              const created = await Users.create({
                user_id: bpData.user?.id || result.user?.email,
                givenName: result.user?.givenName,
                company: result.user?.company,
                email: result.user?.email,
                displayName: result.user?.displayName,
                sub: result.user?.sub,
                key: remoteKey || process.env.BOTPRESS_API_USER_KEY,
                botpressResponse: bpData,
                createdAt: new Date().toISOString()
              });
              dbUser = created;
              xUserKey = remoteKey || process.env.BOTPRESS_API_USER_KEY;
            } else {
              const txt = await bpResp.text().catch(() => '');
              // Botpress returned an HTTP error; save the response body for debugging and
              // persist a DB entry using the configured fallback key so login can continue.
              const created = await Users.create({
                user_id: result.user?.email,
                givenName: result.user?.givenName,
                company: result.user?.company,
                email: result.user?.email,
                displayName: result.user?.displayName,
                sub: result.user?.sub,
                key: process.env.BOTPRESS_API_USER_KEY,
                botpressError: `status:${bpResp.status} body:${txt}`,
                createdAt: new Date().toISOString()
              });
              dbUser = created;
              xUserKey = process.env.BOTPRESS_API_USER_KEY;
            }
          } else {
            // No service key configured: create a local DB user using the configured fallback key
            const created = await Users.create({
              user_id: result.user?.email,
              givenName: result.user?.givenName,
              company: result.user?.company,
              email: result.user?.email,
              displayName: result.user?.displayName,
              sub: result.user?.sub,
              key: process.env.BOTPRESS_API_USER_KEY,
              createdAt: new Date().toISOString()
            });
            dbUser = created;
            xUserKey = process.env.BOTPRESS_API_USER_KEY;
          }
        }
      } catch (dbErr) {
        console.warn('[api/callback] user lookup/create error', dbErr);
      }

      // Set a readable `user_data` cookie for client-side UI and convenience. This cookie is
      // intentionally not HttpOnly so frontend code can read user displayName/email for UI.
      const userDataForCookie = { ...(result.user || {}), key: xUserKey };
      res.cookies.set('user_data', JSON.stringify(userDataForCookie), {
        httpOnly: false,
        path: '/',
        sameSite: 'lax',
        secure: config.cookieConfig.secure,
        maxAge: 60 * 60 * 24 * config.cookieConfig.expires,
      });

      // Set the `x-user-key` cookie (readable) so client-side Botpress calls include the correct key.
      const finalUserKey = xUserKey || dbUser?.key || process.env.BOTPRESS_API_USER_KEY;
      res.cookies.set('x-user-key', finalUserKey, {
        httpOnly: false,
        path: '/',
        sameSite: 'lax',
        secure: config.cookieConfig.secure,
        maxAge: 60 * 60 * 24 * config.cookieConfig.expires,
      });

      // Clean up the short-lived PKCE cookie since it is no longer needed
      res.cookies.delete('pkce_code_verifier');

      return res;
    } catch (err) {
      console.error('Token exchange error:', err);
      return NextResponse.redirect(new URL('/login?error=token_exchange_failed', process.env.NEXT_PUBLIC_APP_URL || 'https://wiki.vietjetthai.com'));
    }
  } catch (err) {
    console.error('Callback error:', err);
    return NextResponse.redirect(new URL('/login?error=callback_error', process.env.NEXT_PUBLIC_APP_URL || 'https://wiki.vietjetthai.com'));
  }
}