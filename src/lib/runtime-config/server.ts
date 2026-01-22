import 'server-only';

export type CookieConfig = {
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  expiresDays: number;
};

export type ServerRuntimeConfig = {
  ldapAuthUrl: string;
  clientId: string;
  /**
   * Full callback URL, e.g. https://example.com/api/auth/callback
   */
  redirectUri: string;
  /**
   * App origin, e.g. https://example.com
   */
  appUrl: string;
  /**
   * Environment string used by the app/business logic (e.g. uat/prod).
   */
  appEnv?: string;
  cookieConfig: CookieConfig;
};

function normalizeOrigin(originOrUrl: string): string {
  try {
    // If it's already an origin or a full URL, URL() can parse it.
    const u = new URL(originOrUrl);
    return u.origin;
  } catch {
    // Last resort: return as-is (should already be an origin).
    return originOrUrl;
  }
}

/**
 * Read runtime config from server environment variables.
 *
 * NOTE:
 * - Uses server-only env vars.
 * - Does NOT expose secrets to the client; use `/api/config` for a safe subset.
 */
function buildServerRuntimeConfig(): ServerRuntimeConfig {
  const appUrl = normalizeOrigin(process.env.APP_URL || 'http://localhost:3001');

  const ldapAuthUrl =
    process.env.LDAP_AUTH_URL ||
    'https://zu4airs4fpwj2t2pxln6uweupa0qsryn.lambda-url.ap-southeast-1.on.aws';

  const clientId = process.env.LDAP_CLIENT_ID || 'vz-wiki-frontend';

  const redirectUri =
    process.env.LDAP_REDIRECT_URI ||
    `${appUrl.replace(/\/$/, '')}/api/auth/callback`;

  const appEnv = process.env.APP_ENV;

  const isProd = process.env.NODE_ENV === 'production';
  const cookieConfig: CookieConfig = {
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    expiresDays: 7,
  };

  return {
    ldapAuthUrl,
    clientId,
    redirectUri,
    appUrl,
    appEnv,
    cookieConfig,
  };
}

/**
 * Cached server runtime config (computed once per server instance).
 */
export const serverRuntimeConfig: ServerRuntimeConfig = buildServerRuntimeConfig();

export function getServerRuntimeConfig(): ServerRuntimeConfig {
  return serverRuntimeConfig;
}

