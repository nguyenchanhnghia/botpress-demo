import Cookies from 'js-cookie';

// Browser-compatible UUID generation
function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export interface User {
    id: string;
    username: string;
    email?: string;
    role: string;
}

const AUTH_COOKIE_NAME = 'auth_token';
const USER_COOKIE_NAME = 'user_data';
const USER_KEY_COOKIE_NAME = 'x-user-key';
const CONVERSATION_COOKIE_NAME = 'conversation_data';

export const auth = {
    // Set authentication cookies
    login: (user: User, token: string) => {
        Cookies.set(AUTH_COOKIE_NAME, token, { expires: 7 }); // 7 days
        Cookies.set(USER_COOKIE_NAME, JSON.stringify(user), { expires: 7 });
        // Set the x-user-key cookie for Botpress
        Cookies.set(USER_KEY_COOKIE_NAME, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InVzZXJfMDFKWjU3S0Y1UTlLQ0FBNU1HRFNRUkJYRDEiLCJpYXQiOjE3NTE1MTE2MzR9.l2_g9TA6QcOuKCOp8NykOHF9IpX64STtk_hBf3zAAaI', { expires: 7 });
    },

    // Remove authentication cookies
    logout: () => {
        Cookies.remove(AUTH_COOKIE_NAME);
        Cookies.remove(USER_COOKIE_NAME);
        Cookies.remove(USER_KEY_COOKIE_NAME);
        Cookies.remove(CONVERSATION_COOKIE_NAME);
    },

    // Get current user from cookies
    getCurrentUser: (): User | null => {
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
        const token = Cookies.get(AUTH_COOKIE_NAME);
        return !!token;
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
        Cookies.set(CONVERSATION_COOKIE_NAME, JSON.stringify(conversation), { expires: 7 });
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

// Updated authentication function that calls the MongoDB API
export const authenticateUser = async (username: string, password: string): Promise<{ user: User; token: string } | null> => {
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Login failed');
        }

        const data = await response.json();

        if (data.success) {
            // Store user info in client-side state (not the accessToken)
            auth.login(data.user, 'authenticated');
            return {
                user: data.user,
                token: 'authenticated' // We don't store the actual accessToken on client
            };
        }

        return null;
    } catch (error) {
        console.error('Authentication error:', error);
        throw error;
    }
};

// Add a function to check authentication status from server
export const checkAuthStatus = async (): Promise<User | null> => {
    try {
        const response = await fetch('/api/protected');
        if (response.ok) {
            const data = await response.json();
            return data.user;
        }
        return null;
    } catch (error) {
        console.error('Auth status check error:', error);
        return null;
    }
};

// Add a function to logout via API
export const logoutUser = async (): Promise<void> => {
    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
        });
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        // Always clear client-side state
        auth.logout();
    }
};

// Botpress API functions
const BOTPRESS_BASE_URL = 'https://chat.botpress.cloud/9c1b585b-b19e-4c07-ba48-cbf53b2cb6e8';

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
    // Get or create user
    getOrCreateUser: async (userKey: string) => {
        return retryWithBackoff(async () => {
            const response = await fetch(`${BOTPRESS_BASE_URL}/users/get-or-create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-key': userKey
                },
                body: JSON.stringify({
                    name: 'Nghia Nguyen',
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
    listenMessages: async (userKey: string, conversationId: string, onMessage: (data: any) => void) => {
        // Create a custom EventSource with headers using fetch and ReadableStream
        const response = await fetch(`${BOTPRESS_BASE_URL}/conversations/${conversationId}/listen`, {
            method: 'GET',
            headers: {
                'Accept': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'x-user-key': userKey
            }
        });

        if (!response.ok) {
            throw new Error('Failed to establish SSE connection');
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
            throw new Error('Failed to get response reader');
        }

        const processStream = async () => {
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const dataString = line.slice(6);

                            // Handle ping messages
                            if (dataString === 'ping') {
                                console.log('Received ping');
                                continue;
                            }

                            try {
                                const data = JSON.parse(dataString);
                                console.log('Received SSE data:', data);

                                // Handle message_created events
                                if (data.type === 'message_created' && data.data) {
                                    onMessage(data.data);
                                } else {
                                    // Pass through other event types
                                    onMessage(data);
                                }
                            } catch (error) {
                                console.error('Error parsing SSE message:', error);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('SSE stream error:', error);
            }
        };

        // Start processing the stream
        processStream();

        // Return a mock EventSource-like object for compatibility
        return {
            close: () => {
                reader.cancel();
            },
            onmessage: null,
            onerror: null
        };
    }
}; 