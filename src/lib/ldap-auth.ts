import { jwtVerify, createRemoteJWKSet, decodeJwt } from 'jose';
import Cookies from 'js-cookie';
import { config } from './config';

export interface LDAPUser {
  sub: string;
  email?: string;
  department?: string;
  title?: string;
  displayName?: string;
  givenName?: string;
  company?: string;
  role?: string; // User role from DynamoDB (e.g., 'admin', 'super-admin', 'ict', 'com', 'pd')
}

export interface AuthToken {
  sub: string;
  email?: string;
  department?: string;
  title?: string;
  displayName?: string;
  iat: number;
  exp: number;
  aud: string;
  iss: string;
  givenName?: string;
  company?: string;
}

const AUTH_COOKIE_NAME = 'auth_token';
const USER_COOKIE_NAME = 'user_data';
const USER_KEY_COOKIE_NAME = 'x-user-key';
const CONVERSATION_COOKIE_NAME = 'conversation_data';

// LDAP Auth service configuration
const LDAP_AUTH_BASE_URL = config.ldapAuthUrl;
const CLIENT_ID = config.clientId;
const REDIRECT_URI = config.redirectUri;



export const ldapAuth = {
  // Generate PKCE parameters for OAuth flow
  generatePKCE: async () => {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    return { codeVerifier, codeChallenge };
  },

  // Get authorization URL for LDAP login
  getAuthorizationUrl: async (_state?: string) => {
    const { codeVerifier, codeChallenge } = await ldapAuth.generatePKCE();

    // Store code verifier in a short-lived cookie so server-side callback can read it
    // Use a small expiry (minutes) to limit lifetime
    if (typeof window !== 'undefined') {
      // expires is in days for js-cookie; use ~0.007 days ~= 10 minutes
      // Use SameSite=lax so the cookie is sent on the OAuth provider redirect (top-level GET)
      Cookies.set('pkce_code_verifier', codeVerifier, {
        expires: 0.007,
        secure: config.cookieConfig.secure,
        sameSite: 'lax',
        path: '/'
      });
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: 'openid email profile',
      state: _state || generateRandomString(),
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      nonce: generateRandomString()
    });

    return `${LDAP_AUTH_BASE_URL}/authorize?${params.toString()}`;
  },

  // Exchange authorization code for tokens
  // Accept optional codeVerifier for server-side exchanges
  exchangeCodeForToken: async (code: string, codeVerifierFromServer?: string): Promise<{ user: LDAPUser; token: string } | null> => {
    try {
      // Prefer the explicitly provided code verifier (server-side). Otherwise read from cookie in browser.
      let codeVerifier: string | null = null;
      if (codeVerifierFromServer) {
        codeVerifier = codeVerifierFromServer;
      } else if (typeof window !== 'undefined') {
        codeVerifier = Cookies.get('pkce_code_verifier') || null;
      }

      if (!codeVerifier) {
        throw new Error('Code verifier not found');
      }

      const response = await fetch(`${LDAP_AUTH_BASE_URL}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: CLIENT_ID,
          redirect_uri: REDIRECT_URI,
          code,
          code_verifier: codeVerifier
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error_description || 'Token exchange failed');
      }

      const data = await response.json();

      // Verify and decode the JWT token
      // Decode the token to discover the issuer and build JWKS endpoint dynamically
      const decoded = decodeJwt(data.id_token as string) as any;
      const tokenIssuer: string = decoded.iss || LDAP_AUTH_BASE_URL;
      const jwksUrl = `${tokenIssuer.replace(/\/$/, '')}/.well-known/jwks.json`;
      const jwks = createRemoteJWKSet(new URL(jwksUrl));

      const { payload } = await jwtVerify(data.id_token, jwks, {
        audience: CLIENT_ID,
        issuer: tokenIssuer
      });

      const user: LDAPUser = {
        sub: payload.sub as string,
        email: payload.email as string,
        department: payload.department as string,
        title: payload.title as string,
        displayName: payload.displayName as string,
        givenName: payload.givenName as string,
        company: payload.company as string
      };

      // If running in the browser, persist client-side cookies and cleanup PKCE cookie
      if (typeof window !== 'undefined') {
        auth.login(user, data.id_token);
        Cookies.remove('pkce_code_verifier');
      }

      // Return result to caller (server callback will set cookies on the response)
      return { user, token: data.id_token };
    } catch (error) {
      console.error('Token exchange error:', error);
      throw error;
    }
  },

  // Verify token and get user info
  verifyToken: async (token: string): Promise<LDAPUser | null> => {
    try {
      const decoded = decodeJwt(token as string) as any;
      const tokenIssuer: string = decoded.iss || LDAP_AUTH_BASE_URL;
      const jwksUrl = `${tokenIssuer.replace(/\/$/, '')}/.well-known/jwks.json`;
      const jwks = createRemoteJWKSet(new URL(jwksUrl));

      const { payload } = await jwtVerify(token, jwks, {
        audience: CLIENT_ID,
        issuer: tokenIssuer
      });

      return {
        sub: payload.sub as string,
        email: payload.email as string,
        department: payload.department as string,
        title: payload.title as string,
        displayName: payload.displayName as string,
        givenName: payload.givenName as string,
        company: payload.company as string
      };
    } catch (error) {
      console.error('Token verification error:', error);
      return null;
    }
  },

  // Check if token is expired
  isTokenExpired: (token: string): boolean => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const now = Math.floor(Date.now() / 1000);
      return payload.exp < now;
    } catch {
      return true;
    }
  }
};

// Cookie-based session management
export const auth = {
  // Set authentication cookies
  login: (user: LDAPUser, token: string) => {
    Cookies.set(AUTH_COOKIE_NAME, token, {
      expires: config.cookieConfig.expires,
      secure: config.cookieConfig.secure,
      sameSite: config.cookieConfig.sameSite
    });
    Cookies.set(USER_COOKIE_NAME, JSON.stringify(user), {
      expires: config.cookieConfig.expires,
      secure: config.cookieConfig.secure,
      sameSite: config.cookieConfig.sameSite
    });
    // Set the x-user-key cookie for Botpress
    Cookies.set(USER_KEY_COOKIE_NAME, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjljMWI1ODViLWIxOWUtNGMwNy1iYTQ4LWNiZjUzYjJjYjZlOCIsImlhdCI6MTc2MTA0NDc0OH0.3tVt0zkrYH5SAuAxEdynXPprq38TRfUSngm2pTBjucw', {
      expires: config.cookieConfig.expires,
      secure: config.cookieConfig.secure,
      sameSite: config.cookieConfig.sameSite
    });
  },

  // Remove authentication cookies
  logout: () => {
    Cookies.remove(AUTH_COOKIE_NAME);
    Cookies.remove(USER_COOKIE_NAME);
    Cookies.remove(USER_KEY_COOKIE_NAME);
    Cookies.remove(CONVERSATION_COOKIE_NAME);
  },

  // Get current user from cookies
  getCurrentUser: (): LDAPUser | null => {
    const userData = Cookies.get(USER_COOKIE_NAME);
    if (!userData) return null;

    try {
      return JSON.parse(userData);
    } catch {
      return null;
    }
  },

  // Check if user is authenticated
  isAuthenticated: (): boolean => {
    // Try to read the auth token cookie (may be httpOnly and thus not readable client-side)
    const token = Cookies.get(AUTH_COOKIE_NAME);
    if (token) {
      // Check if token is expired
      return !ldapAuth.isTokenExpired(token);
    }

    // Fallback: if a readable user cookie or user-key exists, assume authenticated client-side
    const userData = Cookies.get(USER_COOKIE_NAME);
    const userKey = Cookies.get(USER_KEY_COOKIE_NAME);
    if (userData || userKey) {
      return true;
    }

    return false;
  },

  // Get auth token
  getToken: (): string | undefined => {
    return Cookies.get(AUTH_COOKIE_NAME);
  },

  // Get x-user-key for Botpress
  getUserKey: (): string | undefined => {
    return Cookies.get(USER_KEY_COOKIE_NAME);
  },

  // Save conversation data to cookie
  saveConversation: (conversation: { id: string; userId: string }) => {
    Cookies.set(CONVERSATION_COOKIE_NAME, JSON.stringify(conversation), {
      expires: config.cookieConfig.expires,
      secure: config.cookieConfig.secure,
      sameSite: config.cookieConfig.sameSite
    });
  },

  // Get cached conversation data
  getCachedConversation: (): { id: string; userId: string } | null => {
    const conversationData = Cookies.get(CONVERSATION_COOKIE_NAME);
    if (!conversationData) return null;

    try {
      return JSON.parse(conversationData);
    } catch {
      return null;
    }
  },

  // Clear cached conversation
  clearConversation: () => {
    Cookies.remove(CONVERSATION_COOKIE_NAME);
  }
};

// Utility functions
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64URLEncode(new Uint8Array(digest));
}

function base64URLEncode(buffer: Uint8Array): string {
  return btoa(String.fromCharCode(...buffer))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function generateRandomString(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Botpress API functions (keeping the same as before)
const BOTPRESS_BASE_URL = 'https://chat.botpress.cloud/6e333992-4bc2-452f-9089-990386321bf5';

// Retry function with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      if (attempt === maxRetries) {
        throw lastError;
      }

      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`API call failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

export const botpressAPI = {
  // Send the custom event
  sendCustomEvent: async (userKey: string, conversationId: string, eventPayload: any) => {
    return retryWithBackoff(async () => {
      const response = await fetch(`${BOTPRESS_BASE_URL}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-key': userKey
        },
        body: JSON.stringify({
          payload: eventPayload,
          conversationId: conversationId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send custom event');
      }

      return response.json();
    });
  },

  // Get or create user
  getOrCreateUser: async (userKey: string) => {
    return retryWithBackoff(async () => {
      const user = auth.getCurrentUser();
      if (!user) {
        throw new Error('No authenticated user found');
      }
      const response = await fetch(`${BOTPRESS_BASE_URL}/users/get-or-create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-key': userKey
        },
        body: JSON.stringify({
          name: user.displayName || user.email,
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get or create user');
      }

      return response.json();
    });
  },

  // Validate if a conversation exists
  validateConversation: async (userKey: string, conversationId: string) => {
    return retryWithBackoff(async () => {
      const response = await fetch(`${BOTPRESS_BASE_URL}/conversations/${conversationId}`, {
        method: 'GET',
        headers: {
          'x-user-key': userKey
        }
      });

      if (!response.ok) {
        throw new Error('Conversation not found');
      }

      return response.json();
    });
  },

  // Get or create conversation
  getOrCreateConversation: async (userKey: string) => {
    return retryWithBackoff(async () => {
      const response = await fetch(`${BOTPRESS_BASE_URL}/conversations/get-or-create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-key': userKey
        },
        body: JSON.stringify({
          id: generateUUID()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get or create conversation');
      }

      return response.json();
    });
  },

  // List messages
  listMessages: async (userKey: string, conversationId: string) => {
    return retryWithBackoff(async () => {
      const response = await fetch(`${BOTPRESS_BASE_URL}/conversations/${conversationId}/messages`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-user-key': userKey
        }
      });

      if (!response.ok) {
        throw new Error('Failed to list messages');
      }

      return response.json();
    });
  },

  // Send message
  sendMessage: async (userKey: string, conversationId: string, text: string) => {
    return retryWithBackoff(async () => {
      const response = await fetch(`${BOTPRESS_BASE_URL}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-key': userKey
        },
        body: JSON.stringify({
          payload: {
            text: text,
            type: "text"
          },
          conversationId: conversationId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      return response.json();
    });
  },

  // Listen for new messages (SSE)
  listenMessages: async (userKey: string, conversationId: string, onMessage: (data: any) => void, onError?: (error: Error) => void) => {
    // Use AbortController to allow cancelling the underlying fetch and socket
    const controller = new AbortController();

    // Create a custom EventSource with headers using fetch and ReadableStream
    const response = await fetch(`${BOTPRESS_BASE_URL}/conversations/${conversationId}/listen`, {
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'x-user-key': userKey
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error('Failed to establish SSE connection');
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('Failed to get response reader');
    }

    let closed = false;

    const processStream = async () => {
      try {
        while (true) {
          const { done, value } = await reader!.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataString = line.slice(6);

              // Handle ping messages
              if (dataString === 'ping') {
                // keep-alive ping
                continue;
              }

              try {
                const data = JSON.parse(dataString);

                // Handle message_created events
                if (data.type === 'message_created' && data.data) {
                  onMessage(data.data);
                } else {
                  // Pass through other event types
                  onMessage(data);
                }
              } catch {
                // ignore JSON parse errors for partial chunks
              }
            }
          }
        }
      } catch (error) {
        // AbortError is expected when controller.abort() is called - silently ignore it
        if ((error as any)?.name !== 'AbortError') {
          console.error('SSE stream error:', error);
          // Notify about disconnection if not manually closed
          if (!closed && onError) {
            onError(error instanceof Error ? error : new Error('SSE stream disconnected'));
          }
        }
      } finally {
        // Ensure reader is cancelled and mark closed
        try {
          if (reader && !closed) {
            await reader.cancel();
            // If we reach here and closed is still false, it means the stream ended unexpectedly
            if (!closed && onError) {
              onError(new Error('SSE stream ended unexpectedly'));
            }
          }
        } catch {
          // ignore
        }
        closed = true;
      }
    };

    // Start processing the stream (don't await)
    processStream();

    // Return EventSource-like object for compatibility
    return {
      close: () => {
        if (closed) return;
        closed = true;
        try {
          controller.abort();
        } catch (err) {
          // AbortError is expected when aborting - ignore it
          if ((err as any)?.name !== 'AbortError') {
            console.debug('Error aborting controller:', err);
          }
        }
        try {
          if (reader) {
            reader.cancel().catch(() => {
              // Ignore cancel errors - they're expected
            });
          }
        } catch (err) {
          // Ignore any errors during cancel
          if ((err as any)?.name !== 'AbortError') {
            console.debug('Error cancelling reader:', err);
          }
        }
      },
      onmessage: null,
      onerror: null
    };
  }
};

// Browser-compatible UUID generation
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
