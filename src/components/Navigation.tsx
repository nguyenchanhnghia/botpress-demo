'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { auth } from '@/lib/auth';

export default function Navigation() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
        setIsAuthenticated(auth.isAuthenticated());
    }, []);

    // Don't render authentication-dependent content until client-side
    if (!isClient) {
        return (
            <nav className="bg-white/70 backdrop-blur-xl border-b border-white/20 p-4 sticky top-0 z-50">
                <div className="max-w-4xl mx-auto flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-sm">V</span>
                        </div>
                        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">VZ Wiki Frontend</h1>
                    </div>
                    <div className="flex gap-4">
                        <Link href="/login" className="px-4 py-2 text-gray-700 hover:text-blue-600 transition-colors duration-200 font-medium">
                            Login
                        </Link>
                    </div>
                </div>
            </nav>
        );
    }

    return (
        <nav className="bg-white/70 backdrop-blur-xl border-b border-white/20 p-4 sticky top-0 z-50">
            <div className="max-w-4xl mx-auto flex justify-between items-center">
                <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-sm">V</span>
                    </div>
                    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">VZ Wiki Frontend</h1>
                </div>
                <div className="flex gap-4">

                    {isAuthenticated && (
                        <Link href="/botChat" className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200 font-medium shadow-lg">
                            Bot Chat
                        </Link>
                    )}
                </div>
            </div>
        </nav>
    );
} 