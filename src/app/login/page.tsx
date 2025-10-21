'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/auth';
import { ldapAuth } from '@/lib/ldap-auth';

export default function LoginPage() {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        // Check if user is already authenticated
        if (auth.isAuthenticated()) {
            router.push('/dashboard');
            return;
        }

        // Check for error parameters from window.location.search (client-side only)
        let errorParam: string | null = null;
        try {
            const params = new URLSearchParams(window.location.search);
            errorParam = params.get('error');
        } catch {
            errorParam = null;
        }
        if (errorParam) {
            switch (errorParam) {
                case 'oauth_error':
                    setError('OAuth authentication failed');
                    break;
                case 'no_code':
                    setError('No authorization code received');
                    break;
                case 'auth_failed':
                    setError('Authentication failed');
                    break;
                case 'token_exchange_failed':
                    setError('Token exchange failed');
                    break;
                case 'callback_error':
                    setError('Callback error occurred');
                    break;
                case 'token_expired':
                    setError('Your session has expired. Please log in again.');
                    break;
                case 'no_token':
                    setError('No authentication token found. Please log in.');
                    break;
                case 'invalid_token':
                    setError('Invalid authentication token. Please log in again.');
                    break;
                default:
                    setError('An unknown error occurred');
            }
        }
    }, [router]);

    const handleLogin = async () => {
        setIsLoading(true);
        try {
            // Use centralized LDAP auth helper to get the authorization URL (handles PKCE)
            const url = await ldapAuth.getAuthorizationUrl();
            // In case the helper returned a relative or absolute URL, redirect the browser
            window.location.href = url;
        } catch (error) {
            console.error('Login error:', error);
            setError('Failed to initiate login');
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Sign in to VZ Wiki
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Use your LDAP credentials to access the system
                    </p>
                    {/* Debug text for not logged in users */}
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                        <p className="text-sm text-yellow-800 text-center">
                            🔍 DEBUG: User not logged in - Authentication required
                        </p>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
                        {error}
                    </div>
                )}

                <div className="mt-8 space-y-6">
                    <div>
                        <button
                            onClick={handleLogin}
                            disabled={isLoading}
                            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <div className="flex items-center">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                    Redirecting...
                                </div>
                            ) : (
                                'Sign in with LDAP'
                            )}
                        </button>
                    </div>

                    <div className="text-center">
                        <p className="text-sm text-gray-600">
                            You will be redirected to the LDAP authentication server
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}