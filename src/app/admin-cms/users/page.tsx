import Users from '@/lib/aws/users';
import { ldapAuth } from '@/lib/ldap-auth';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminUsersClient from './AdminUsersClient';

export default async function AdminUsersPage() {
  // Server-side auth: read token from cookies or headers
  try {
    const cookieStore = await cookies();
    const cookieToken = cookieStore.get('auth_token')?.value || null;
    const headersList = await headers();
    const headerToken = headersList.get('authorization')?.replace('Bearer ', '') || null;
    const finalToken = cookieToken || headerToken;

    if (!finalToken) return redirect('/login');

    const user = await ldapAuth.verifyToken(finalToken);
    if (!user) return redirect('/login');

    // Ensure requester is admin in Dynamo
    const requesterRecord = await Users.findByEmail(user.email || '');
    if (!requesterRecord || !['admin', 'super-admin'].includes(requesterRecord.role)) {
      // Render access denied server-side
      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
          <div className="max-w-md mx-auto bg-white/80 rounded-2xl shadow-xl p-8 text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
            <p className="text-gray-600 mb-6">Admin privileges required.</p>
            <a href="/botChat" className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-1 rounded-md">Go Back</a>
          </div>
        </div>
      );
    }

    // Fetch users server-side using AWS Users helper
    const usersList = await Users.list();

    // Render client UI and pass users list as initial prop
    return <AdminUsersClient initialUsers={usersList} />;
  } catch (err) {
    console.error('Server-side auth error:', err);
    return redirect('/login');
  }
}

