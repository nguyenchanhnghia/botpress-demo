import { NextRequest, NextResponse } from 'next/server';
import Users from '@/lib/aws/users';
import { serverRuntimeConfig } from '@/lib/runtime-config/server';
import crypto from 'crypto';

function isUatEnv(): boolean {
  return (serverRuntimeConfig.appEnv || '').toLowerCase() === 'uat';
}

function normalizeEmail(email: string): string {
  return (email || '').trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  // Simple validation (good enough for login gating)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeHash(hash: string | undefined | null): string {
  return String(hash || '').trim().toLowerCase();
}

function md5Hex(input: string): string {
  return crypto.createHash('md5').update(input, 'utf8').digest('hex');
}

function timingSafeEqualString(a: string, b: string): boolean {
  // Only compare equal-length buffers; otherwise it throws.
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

/**
 * UAT-only email login.
 *
 * POST body: { email: string, password: string }
 * - Looks up the email in DynamoDB users table
 * - Validates password by comparing MD5(password) to the stored hash in DynamoDB
 * - If found, sets cookies (`user_data`, `x-user-key`) used by the client UI
 */
export async function POST(req: NextRequest) {
  if (!isUatEnv()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const body = await req.json().catch(() => ({} as any));
    const email = normalizeEmail(body?.email || '');
    const password = String(body?.password || '');

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    const record = await Users.findByEmail(email);
    if (!record) {
      return NextResponse.json({ error: 'Unauthorized - user not found' }, { status: 401 });
    }

    // Password check (MD5) — expected to be stored on the user record for UAT login only.
    const storedMd5 = normalizeHash(
      (record as any).password ||
      (record as any).passwordHash // legacy name from older docs/types
    );

    if (!storedMd5) {
      return NextResponse.json({ error: 'Unauthorized - password not configured for this user' }, { status: 401 });
    }

    const computed = md5Hex(password);
    const ok = timingSafeEqualString(computed, storedMd5);
    if (!ok) {
      return NextResponse.json({ error: 'Unauthorized - invalid credentials' }, { status: 401 });
    }

    const runtime = serverRuntimeConfig;

    const userDataForCookie: any = {
      // Align with the shape the UI expects from OIDC
      sub: (record as any).sub || record.id || (record as any).user_id || email,
      email: record.email || email,
      displayName: record.displayName || (record as any).givenName || email,
      department: (record as any).department,
      title: (record as any).title,
      company: (record as any).company,
      givenName: (record as any).givenName,

      // Role/key from DynamoDB
      role: (record as any).role,
      key: (record as any).key,

      // Keep original record ids for debugging
      id: record.id,
      user_id: (record as any).user_id,
    };

    const xUserKey = (record as any).key || process.env.DEFAULT_BOTPRESS_KEY || process.env.BOTPRESS_API_USER_KEY;

    const res = NextResponse.json({
      success: true,
      user: userDataForCookie,
    });

    // Set readable cookies used by the client
    res.cookies.set('user_data', JSON.stringify(userDataForCookie), {
      httpOnly: false,
      path: '/',
      sameSite: 'lax',
      secure: runtime.cookieConfig.secure,
      maxAge: 60 * 60 * 24 * runtime.cookieConfig.expiresDays,
    });

    if (xUserKey) {
      res.cookies.set('x-user-key', xUserKey, {
        httpOnly: false,
        path: '/',
        sameSite: 'lax',
        secure: runtime.cookieConfig.secure,
        maxAge: 60 * 60 * 24 * runtime.cookieConfig.expiresDays,
      });
    }

    // Clear cached conversation so a new session starts cleanly
    res.cookies.delete({ name: 'conversation_data', path: '/' });

    return res;
  } catch (err: any) {
    console.error('[uat-login] error:', err);
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 });
  }
}

