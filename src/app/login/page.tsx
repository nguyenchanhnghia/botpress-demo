'use client';

import React from "react";
import { LoginForm } from '@/components/auth/LoginForm';
import { UserProvider } from '@/components/auth/UserContext';

export default function LoginPage() {
    return (
        <UserProvider>
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 relative overflow-hidden">
                {/* Background blur elements */}
                <div className="absolute inset-0">
                    <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob-move" style={{ backgroundColor: '#ffd234', animationDelay: '0s' }}></div>
                    <div className="absolute top-1/3 right-1/4 w-72 h-72 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob-move" style={{ backgroundColor: '#ffd234', animationDelay: '2s' }}></div>
                    <div className="absolute -bottom-8 left-1/3 w-72 h-72 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob-move" style={{ backgroundColor: '#ed1823', animationDelay: '4s' }}></div>
                </div>
                <div className="relative w-full max-w-md p-8 space-y-6 bg-white/70 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20">
                    <div className="text-center">
                        <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Welcome Back</h2>
                        <p className="text-gray-600 mt-2">Sign in to your account</p>
                    </div>
                    <LoginForm />
                    <div className="text-center p-4 bg-gray-50/50 backdrop-blur-sm rounded-xl border border-gray-200/30">
                        <p className="text-sm font-medium text-gray-700 mb-2">Demo credentials:</p>
                        <p className="text-xs text-gray-600">Username: <span className="font-mono bg-gray-200/50 px-1 rounded">admin</span></p>
                        <p className="text-xs text-gray-600">Password: <span className="font-mono bg-gray-200/50 px-1 rounded">password</span></p>
                    </div>
                </div>
            </div>
        </UserProvider>
    );
} 