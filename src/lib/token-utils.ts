// Simple token utilities without LDAP dependency
export class TokenUtils {
  /**
   * Check if a JWT token is expired
   */
  static isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const now = Math.floor(Date.now() / 1000);
      return payload.exp ? payload.exp < now : true;
    } catch {
      return true;
    }
  }

  /**
   * Check if a token has valid JWT format
   */
  static isValidFormat(token: string): boolean {
    if (!token || typeof token !== 'string') {
      return false;
    }

    const parts = token.split('.');
    return parts.length === 3 && parts.every(part => part.length > 0);
  }

  /**
   * Get token payload without verification (for basic info)
   */
  static getTokenPayload(token: string): any | null {
    try {
      if (!this.isValidFormat(token)) {
        return null;
      }
      return JSON.parse(atob(token.split('.')[1]));
    } catch {
      return null;
    }
  }

  /**
   * Get token expiration time
   */
  static getTokenExpiration(token: string): number | null {
    const payload = this.getTokenPayload(token);
    return payload?.exp || null;
  }

  /**
   * Get time until token expires (in seconds)
   */
  static getTimeUntilExpiration(token: string): number | null {
    const exp = this.getTokenExpiration(token);
    if (!exp) return null;

    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, exp - now);
  }
}
