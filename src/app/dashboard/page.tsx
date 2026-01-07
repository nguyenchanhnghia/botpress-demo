'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, LDAPUser } from '@/lib/ldap-auth';
import { initializeTokenRefresh } from '@/lib/token-refresh';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<LDAPUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check authentication status
    if (!auth.isAuthenticated()) {
      router.push('/login');
      return;
    }

    // Get user data
    const currentUser = auth.getCurrentUser();
    setUser(currentUser);
    
    // Console log user info
    if (currentUser) {
      console.log('[Dashboard] Current user info:', {
        email: currentUser.email,
        displayName: currentUser.displayName,
        role: (currentUser as any).role,
        department: currentUser.department,
        title: currentUser.title,
        company: currentUser.company,
        fullUser: currentUser
      });
    }
    
    setIsLoading(false);

    // Initialize token refresh monitoring
    initializeTokenRefresh();
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      auth.logout();
      router.push('/login');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Authentication Error</h1>
          <p className="text-gray-600 mb-4">Unable to load user information</p>
          <button
            onClick={() => router.push('/login')}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">VZ Wiki Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                Welcome, {user.displayName || user.email || user.sub}
              </span>
              <button
                onClick={handleLogout}
                className="bg-red-600 text-white px-4 py-2 rounded-md text-sm hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">User Information</h2>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Subject ID</dt>
                <dd className="mt-1 text-sm text-gray-900">{user.sub}</dd>
              </div>
              {user.email && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Email</dt>
                  <dd className="mt-1 text-sm text-gray-900">{user.email}</dd>
                </div>
              )}
              {user.department && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Department</dt>
                  <dd className="mt-1 text-sm text-gray-900">{user.department}</dd>
                </div>
              )}
              {user.title && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Title</dt>
                  <dd className="mt-1 text-sm text-gray-900">{user.title}</dd>
                </div>
              )}
              {user.displayName && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Display Name</dt>
                  <dd className="mt-1 text-sm text-gray-900">{user.displayName}</dd>
                </div>
              )}
              {(user as any).role && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Role</dt>
                  <dd className="mt-1">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {(user as any).role.toUpperCase()}
                    </span>
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <div className="mt-6 bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Authentication Status</h2>
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-2 w-2 bg-green-400 rounded-full"></div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">Authenticated via LDAP</p>
                <p className="text-sm text-gray-500">Token is valid and not expired</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
