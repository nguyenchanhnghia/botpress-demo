import { NextRequest, NextResponse } from 'next/server';
import { ldapAuth } from '@/lib/ldap-auth.server';
import { serverRuntimeConfig } from '@/lib/runtime-config/server';
import Users from '@/lib/aws/users';
import { v4 as uuidv4 } from 'uuid';

/**
 * OAuth callback handler (server API route)
 *
 * Purpose:
 * - Process the authorization code returned by the identity provider (OIDC / LDAP provider).
 * - Exchange the code for tokens using ldapAuth.exchangeCodeForToken (server-side PKCE verifier is read
 *   from a cookie `pkce_code_verifier`).
 * - Verify the ID token and build a minimal user object from verified claims.
 * - Persist or lookup the user in DynamoDB (via `Users` helper). If not found in DB, create Botpress
 *   user using `POST /users` with UUID, then create the DB record using the Botpress response.
 *   If Botpress is unavailable or the request fails, fall back to a default static key.
 * - Set cookies for the client:
 *     - `auth_token` (HttpOnly) : the ID token for server-side checks (short-lived)
 *     - `user_data` (readable) : JSON representation of the user for client-side UI
 *     - `x-user-key` (readable) : Botpress user key used by client-side Botpress calls
 * - Redirect the browser to `/botChat` after successful handling.
 *
 * Important env variables used:
 * - BOTPRESS_API_USER_KEY (preferred) | BOTPRESS_SERVICE_KEY | BOTPRESS_TOKEN : service key used for calling
 *   Botpress `/users` on the server.
 * - DEFAULT_BOTPRESS_KEY: fallback key when Botpress API fails
 * - USERS_TABLE, USERS_TABLE_PK, etc. are used by the Users helper to persist records.
 *
 * Notes:
 * - This is a server-side Next.js route (runs in Node). All console logs appear in the server terminal.
 * - The handler is defensive: when Dynamo is unavailable (expired AWS creds) it falls back to calling
 *   Botpress or using a default key so the login flow is not blocked.
 */
const BOTPRESS_BASE_URL = process.env.BOTPRESS_BASE_URL || 'https://chat.botpress.cloud/6e333992-4bc2-452f-9089-990386321bf5';
const DEFAULT_BOTPRESS_KEY = process.env.DEFAULT_BOTPRESS_KEY || process.env.BOTPRESS_API_USER_KEY;


export async function GET(req: NextRequest) {
  const runtime = serverRuntimeConfig;
  const baseUrl = runtime.appUrl;

  try {
    // Parse redirect URL and extract OIDC parameters: authorization code and optional error
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(new URL(`/login?error=oauth_error&message=${encodeURIComponent('OAuth authorization error occurred')}`, baseUrl));
    }

    if (!code) {
      return NextResponse.redirect(new URL(`/login?error=no_code&message=${encodeURIComponent('No authorization code received')}`, baseUrl));
    }

    // PKCE: read the code_verifier stored in a short-lived cookie during the initial authorization request
    // This allows the server-side callback to complete the PKCE exchange (sessionStorage is not available on server)
    const codeVerifier = req.cookies.get('pkce_code_verifier')?.value;

    try {
      // Exchange the authorization code for tokens using ldapAuth helper. We pass the server-side
      // PKCE verifier when available so the token endpoint can validate the PKCE flow.
      const result = await ldapAuth.exchangeCodeForToken(code, codeVerifier || undefined);

      if (!result) {
        return NextResponse.redirect(new URL(`/login?error=auth_failed&message=${encodeURIComponent('Failed to exchange authorization code for tokens')}`, baseUrl));
      }

      const res = NextResponse.redirect(new URL('/botChat', baseUrl));


      res.cookies.set('auth_token', result.token, {
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
        secure: runtime.cookieConfig.secure,
        maxAge: 60 * 60 * 24 * runtime.cookieConfig.expiresDays,
      });

      // Resolve Botpress user key then persist user to DynamoDB.
      // Flow:
      // 1. Try to find existing user in Dynamo by email.
      // 2. If not found, generate UUID and call Botpress `POST /users` to create a new user.
      //    Use the Botpress response to create the user in DynamoDB.
      // 3. If Botpress API fails, fallback to DEFAULT_BOTPRESS_KEY.
      // 4. If all fails, redirect to login with error message.
      let dbUser: any = null;
      let xUserKey: string | undefined = undefined;
      const serviceKey = process.env.BOTPRESS_API_USER_KEY || DEFAULT_BOTPRESS_KEY;

      try {
        // If the ID token includes an email, try the (fast) GSI query to locate the user in DynamoDB
        if (result.user?.email) {
          dbUser = await Users.findByEmail(result.user.email);
        }

        if (dbUser) {
          xUserKey = dbUser.key || serviceKey;
          // Role is already in dbUser from DynamoDB
          // Console log user info from DynamoDB
          console.log('dbUser', dbUser);
          console.log('[api/callback] User info from DynamoDB:', {
            id: dbUser.id,
            email: dbUser.email,
            displayName: dbUser.displayName,
            role: dbUser.role,
            department: dbUser.department,
            title: dbUser.title,
            company: dbUser.company,
            createdAt: dbUser.createdAt,
            fullRecord: dbUser
          });
        } else {
          // User not found in DynamoDB, create new user in Botpress first
          const userId = result.user?.sub || result.user?.email;
          if (!userId) {
            throw new Error('No user identifier (sub or email) available');
          }

          let botpressUser: any = null;
          let botpressKey: string | undefined = undefined;
          let botpressUserId: string | undefined = undefined;

          // Try to create user in Botpress using POST /users
          if (serviceKey) {
            try {
              botpressUserId = uuidv4();
              const bpResp = await fetch(`${BOTPRESS_BASE_URL}/users`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-user-key': serviceKey
                },
                body: JSON.stringify({
                  id: botpressUserId,
                  name: result.user?.displayName || result.user?.email,
                  pictureUrl: '',
                  profile: JSON.stringify({
                    sub: result.user?.sub,
                    email: result.user?.email,
                    title: result.user?.title,
                    department: result.user?.department
                  })
                })
              });

              if (bpResp?.ok) {
                botpressUser = await bpResp.json();
                botpressKey = botpressUser?.key || botpressUser?.user?.key || serviceKey;
              } else {
                const txt = await bpResp.text().catch(() => '');
                console.warn(`[api/callback] Botpress user creation failed: status ${bpResp.status}, body: ${txt}`);
                // Fallback to DEFAULT_BOTPRESS_KEY
                botpressKey = DEFAULT_BOTPRESS_KEY;
              }
            } catch (bpErr) {
              console.error('[api/callback] Botpress API error:', bpErr);
              // Fallback to DEFAULT_BOTPRESS_KEY
              botpressKey = DEFAULT_BOTPRESS_KEY;
            }
          } else {
            // No service key, use fallback
            botpressKey = DEFAULT_BOTPRESS_KEY;
          }

          // Create user in DynamoDB using Botpress response or fallback
          try {
            const created = await Users.create({
              id: userId,
              user_id: botpressUser?.user?.id || botpressUserId || userId,
              givenName: result.user?.givenName,
              company: result.user?.company,
              email: result.user?.email,
              displayName: result.user?.displayName,
              sub: result.user?.sub,
              key: botpressKey || DEFAULT_BOTPRESS_KEY,
              botpressResponse: botpressUser,
              createdAt: new Date().toISOString(),
              role: ''
            });
            dbUser = created;
            xUserKey = botpressKey || DEFAULT_BOTPRESS_KEY;
          } catch (dbErr) {
            console.error('[api/callback] DynamoDB user creation error:', dbErr);
            // If DynamoDB fails but we have a key, continue with that key
            xUserKey = botpressKey || DEFAULT_BOTPRESS_KEY;
          }
        }
      } catch (err) {
        console.error('[api/callback] User creation flow error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to create user';
        return NextResponse.redirect(new URL(`/login?error=user_creation_failed&message=${encodeURIComponent(errorMessage)}`, baseUrl));
      }

      // Set a readable `user_data` cookie for client-side UI and convenience. This cookie is
      // intentionally not HttpOnly so frontend code can read user displayName/email for UI.
      // Include role from DynamoDB if available
      const userDataForCookie = {
        ...(result.user || {}),
        key: xUserKey,
        role: dbUser?.role // Add role from DynamoDB
      };
      res.cookies.set('user_data', JSON.stringify(userDataForCookie), {
        httpOnly: false,
        path: '/',
        sameSite: 'lax',
        secure: runtime.cookieConfig.secure,
        maxAge: 60 * 60 * 24 * runtime.cookieConfig.expiresDays,
      });

      // Set the `x-user-key` cookie (readable) so client-side Botpress calls include the correct key.
      const finalUserKey = xUserKey || dbUser?.key || DEFAULT_BOTPRESS_KEY;
      res.cookies.set('x-user-key', finalUserKey, {
        httpOnly: false,
        path: '/',
        sameSite: 'lax',
        secure: runtime.cookieConfig.secure,
        maxAge: 60 * 60 * 24 * runtime.cookieConfig.expiresDays,
      });

      // Clean up the short-lived PKCE cookie since it is no longer needed
      res.cookies.delete('pkce_code_verifier');

      return res;
    } catch (err) {
      console.error('Token exchange error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to exchange authorization code';
      return NextResponse.redirect(new URL(`/login?error=token_exchange_failed&message=${encodeURIComponent(errorMessage)}`, baseUrl));
    }
  } catch (err) {
    console.error('Callback error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Callback processing failed';
    return NextResponse.redirect(new URL(`/login?error=callback_error&message=${encodeURIComponent(errorMessage)}`, baseUrl));
  }
}