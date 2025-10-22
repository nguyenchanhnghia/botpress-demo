import { NextRequest, NextResponse } from 'next/server';
import { ldapAuth } from '@/lib/ldap-auth';
import { config } from '@/lib/config';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      return NextResponse.redirect(new URL('/login?error=oauth_error', req.url));
    }

    if (!code) {
      console.error('No authorization code received');
      return NextResponse.redirect(new URL('/login?error=no_code', req.url));
    }

    try {
      // Debug: log incoming cookies to verify pkce and other cookies are present
      try {
        const incoming: Record<string, string> = {};
        for (const [k, v] of req.cookies) {
          incoming[k] = v.value;
        }
        console.log('Callback: incoming cookies =', incoming);
      } catch (logErr) {
        console.log('Callback: failed to log incoming cookies', logErr);
      }

      // Read PKCE code_verifier from incoming cookies (set earlier by ldapAuth.getAuthorizationUrl)
      const codeVerifier = req.cookies.get('pkce_code_verifier')?.value;

      const result = await ldapAuth.exchangeCodeForToken(code, codeVerifier || undefined);

      if (result) {
        // On server-side success: set HTTP-only cookies for token and user data
        const res = NextResponse.redirect(new URL('/botChat', req.url));

  // Debug: note we're about to set cookies
  console.log('Callback: setting cookies auth_token, user_data, x-user-key');

  // Set auth token as httpOnly cookie (SameSite=lax so it's set on redirect)
        res.cookies.set('auth_token', result.token, {
          httpOnly: true,
          path: '/',
          sameSite: 'lax',
          secure: config.cookieConfig.secure,
          maxAge: 60 * 60 * 24 * config.cookieConfig.expires
        });

        // Set user data as non-httpOnly cookie so client can read it
        res.cookies.set('user_data', JSON.stringify(result.user), {
          httpOnly: false,
          path: '/',
          sameSite: 'lax',
          secure: config.cookieConfig.secure,
          maxAge: 60 * 60 * 24 * config.cookieConfig.expires
        });

        // Set the x-user-key cookie for Botpress (same static example used in ldap-auth login)
        res.cookies.set('x-user-key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjljMWI1ODViLWIxOWUtNGMwNy1iYTQ4LWNiZjUzYjJjYjZlOCIsImlhdCI6MTc2MTA0NDc0OH0.3tVt0zkrYH5SAuAxEdynXPprq38TRfUSngm2pTBjucw', {
          httpOnly: false,
          path: '/',
          sameSite: 'lax',
          secure: config.cookieConfig.secure,
          maxAge: 60 * 60 * 24 * config.cookieConfig.expires
        });

        console.log('Callback: cookies set on response');

        // Remove PKCE cookie
        res.cookies.delete({ name: 'pkce_code_verifier', path: '/' });

        return res;
      } else {
        return NextResponse.redirect(new URL('/login?error=auth_failed', req.url));
      }
    } catch (error) {
      console.error('Token exchange error:', error);
      return NextResponse.redirect(new URL('/login?error=token_exchange_failed', req.url));
    }
  } catch (error) {
    console.error('Callback error:', error);
    return NextResponse.redirect(new URL('/login?error=callback_error', req.url));
  }
}
