import Cookies from 'js-cookie';

export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiRequestOptions {
    method?: ApiMethod;
    headers?: Record<string, string>;
    body?: any;
    params?: Record<string, string | number | boolean>;
}

export async function apiRequest<T = any>(
    url: string,
    options: ApiRequestOptions & { withAuth?: boolean } = {}
): Promise<T> {
    const { method = 'GET', headers = {}, body, params, withAuth } = options;

    let fullUrl = url;
    if (params && Object.keys(params).length > 0) {
        const query = new URLSearchParams(params as any).toString();
        fullUrl += (url.includes('?') ? '&' : '?') + query;
    }

    const finalHeaders = { ...headers };
    // Note: auth_token cookie is httpOnly and will be sent automatically with fetch
    // The server-side middleware will read it from cookies
    // If a readable token is available, we can add it to Authorization header
    if (withAuth) {
        // Try to get token from readable cookie if available
        const authToken = Cookies.get('auth_token');
        if (authToken) {
            finalHeaders['Authorization'] = `Bearer ${authToken}`;
        }
    }

    // Check if body is FormData
    const isFormData = body instanceof FormData;

    const fetchOptions: RequestInit = {
        method,
        headers: {
            // Don't set Content-Type for FormData - browser will set it with boundary
            ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
            ...finalHeaders,
        },
        credentials: 'include', // Ensure cookies (including httpOnly) are sent
    };

    if (body !== undefined && body !== null) {
        if (isFormData) {
            fetchOptions.body = body;
        } else {
        fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
        }
    }

    const res = await fetch(fullUrl, fetchOptions);
    if (!res.ok) {
        let errorMsg = `API error: ${res.status}`;
        try {
            const errData = await res.json();
            errorMsg = errData.message || errData.error || errorMsg;
        } catch { }
        throw new Error(errorMsg);
    }
    // Try to parse JSON, fallback to text
    try {
        return await res.json();
    } catch {
        return (await res.text()) as any;
    }
}

export async function botpressApiRequest<T = any>(
    url: string,
    clientId?: string,
    options: ApiRequestOptions = {}
): Promise<T> {
    return apiRequest(url, {
        ...options,
        headers: {
            ...getBotpressHeaders(),
            ...(options.headers || {}),
        },
    });
}

export function getBotpressHeaders(): Record<string, string> {
    const userKey = Cookies.get('x-user-key'); // or your cookie name

    return {
        ...(userKey ? { 'x-user-key': userKey } : {}),
    };
} 