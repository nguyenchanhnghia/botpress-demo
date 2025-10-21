import { NextRequest, NextResponse } from 'next/server';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_req: NextRequest) {
  try {
    const res = NextResponse.json({ success: true, message: 'Logged out successfully' });

    // Delete server-set cookies (httpOnly and normal)
    const cookieNames = ['auth_token', 'user_data', 'x-user-key', 'conversation_data', 'pkce_code_verifier', 'oidc_access_token', 'oidc_nonce'];

    for (const name of cookieNames) {
      try {
        res.cookies.delete({ name, path: '/' });
      } catch {
        // ignore deletion errors
      }
    }

    return res;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 });
  }
}
