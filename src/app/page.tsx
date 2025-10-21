'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/auth";

export default function Home() {
  const router = useRouter();
  const [authStatus, setAuthStatus] = useState<string>('Checking...');

  useEffect(() => {
    const isAuth = auth.isAuthenticated();
    console.log('🔍 Home page: Authentication status:', isAuth);

    if (isAuth) {
      setAuthStatus('✅ Authenticated - Redirecting to dashboard');
      console.log('🔄 Home page: Redirecting to dashboard');
      router.push('/dashboard');
    } else {
      setAuthStatus('❌ Not authenticated - Redirecting to login');
      console.log('🔄 Home page: Redirecting to login');
      router.push('/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 relative overflow-hidden">
      {/* Background blur elements */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-1/3 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative text-center">
        <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        </div>
        <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Redirecting...</h2>
        <p className="text-gray-600 mt-2">Please wait while we redirect you</p>

        {/* Debug information */}
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800">
            🔍 DEBUG: {authStatus}
          </p>
        </div>
      </div>
    </div>
  );
}
