import { auth, ldapAuth } from './ldap-auth';

export class TokenRefreshManager {
  private refreshTimer: NodeJS.Timeout | null = null;
  private readonly REFRESH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    if (typeof window !== 'undefined') {
      this.startTokenMonitoring();
    }
  }

  private startTokenMonitoring() {
    // Check token status every 5 minutes
    this.refreshTimer = setInterval(() => {
      this.checkAndHandleTokenExpiration();
    }, this.REFRESH_CHECK_INTERVAL);

    // Also check on page visibility change
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.checkAndHandleTokenExpiration();
      }
    });
  }

  private checkAndHandleTokenExpiration() {
    const token = auth.getToken();

    if (!token) {
      // No token, redirect to login
      this.redirectToLogin('no_token');
      return;
    }

    if (ldapAuth.isTokenExpired(token)) {
      // Token expired, clear cookies and redirect to login
      auth.logout();
      this.redirectToLogin('token_expired');
      return;
    }

    // Token is valid, continue
    console.log('Token is valid');
  }

  private redirectToLogin(reason: string) {
    // Clear any existing timers
    this.clearTimer();

    // Redirect to login with reason
    window.location.href = `/login?error=${reason}`;
  }

  public clearTimer() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  public destroy() {
    this.clearTimer();
  }
}

// Global token refresh manager instance
let tokenRefreshManager: TokenRefreshManager | null = null;

export const initializeTokenRefresh = () => {
  if (typeof window !== 'undefined' && !tokenRefreshManager) {
    tokenRefreshManager = new TokenRefreshManager();
  }
  return tokenRefreshManager;
};

export const destroyTokenRefresh = () => {
  if (tokenRefreshManager) {
    tokenRefreshManager.destroy();
    tokenRefreshManager = null;
  }
};

// Auto-initialize when module is imported in browser
if (typeof window !== 'undefined') {
  initializeTokenRefresh();
}
