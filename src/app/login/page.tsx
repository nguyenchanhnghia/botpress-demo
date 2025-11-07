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
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white py-12 px-4 sm:px-6 lg:px-8">
            <div className="w-full max-w-md">
                <div className="bg-white shadow-lg rounded-2xl p-8">
                    <div className="text-center">
                        <h2 className="text-3xl font-extrabold text-gray-900">Sign in to TVJ Internal AI Assistant</h2>
                        <p className="mt-2 text-sm text-gray-600">Use your Vietjet email to access the system</p>
                    </div>

                    {error && (
                        <div className="mt-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
                            {error}
                        </div>
                    )}

                    <div className="mt-8">
                        <button
                            onClick={handleLogin}
                            disabled={isLoading}
                            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-[#ed1823] hover:bg-[#c71218] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#ed1823]/60 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <div className="flex items-center">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                    Redirecting...
                                </div>
                            ) : (
                                'Sign in with VietJet Email'
                            )}
                        </button>

                    </div>
                </div>
            </div>
        </div>
    );
}