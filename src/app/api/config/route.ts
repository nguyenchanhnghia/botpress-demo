import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { serverRuntimeConfig } from '@/lib/runtime-config/server';

/**
 * Public runtime config endpoint.
 *
 * Returns ONLY non-secret values needed by browser code (no tokens/keys).
 */
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (user instanceof NextResponse) return user;

  const cfg = serverRuntimeConfig;

  return NextResponse.json(
    {
      ldapAuthUrl: cfg.ldapAuthUrl,
      clientId: cfg.clientId,
      redirectUri: cfg.redirectUri,
      appUrl: cfg.appUrl,
      appEnv: cfg.appEnv,
    },
    {
      // Allow caching in the browser; update requires reload.
      headers: { 'Cache-Control': 'private, max-age=300' },
    }
  );
}

