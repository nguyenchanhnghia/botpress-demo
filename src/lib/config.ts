// Configuration for LDAP authentication
type SameSiteOption = 'strict' | 'lax' | 'none' | 'Strict' | 'Lax' | 'None' | undefined;

interface CookieConfig {
  secure: boolean;
  sameSite?: SameSiteOption;
  expires: number; // days
}

export const config: {
  ldapAuthUrl: string;
  clientId: string;
  redirectUri: string;
  appUrl: string;
  cookieConfig: CookieConfig;
} = {
  // LDAP Auth Service Configuration
  ldapAuthUrl: process.env.NEXT_PUBLIC_LDAP_AUTH_URL || 'https://zu4airs4fpwj2t2pxln6uweupa0qsryn.lambda-url.ap-southeast-1.on.aws',
  clientId: process.env.NEXT_PUBLIC_CLIENT_ID || 'vz-wiki-frontend',
  redirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI || 'https://botpress-demo-3nc9-git-main-nghiancs-projects.vercel.app/api/auth/callback',

  // App Configuration
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://botpress-demo-3nc9-git-main-nghiancs-projects.vercel.app/',

  // Cookie Configuration
  cookieConfig: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
    expires: 7
  }
};
