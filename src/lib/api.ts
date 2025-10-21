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
    if (withAuth) {
        const accessToken = Cookies.get('accessToken');
        if (accessToken) {
            finalHeaders['Authorization'] = `Bearer ${accessToken}`;
        }
    }

    const fetchOptions: RequestInit = {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...finalHeaders,
        },
    };

    if (body !== undefined && body !== null) {
        fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
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
    const token = process.env.NEXT_PUBLIC_BOTPRESS_TOKEN || process.env.BOTPRESS_TOKEN;
    const userKey = Cookies.get('x-user-key'); // or your cookie name

    return {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(userKey ? { 'x-user-key': userKey } : {}),
    };
} 