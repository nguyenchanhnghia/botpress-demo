'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { apiRequest } from '@/lib/api';
import { Button } from '@/components/common/Button';
import type { UserRecord } from '@/lib/aws/users';
import UserMenu from '@/components/common/UserMenu';

const ROLES = ['admin'];

interface AdminUsersClientProps {
  initialUsers: UserRecord[];
}

export default function AdminUsersClient({ initialUsers }: AdminUsersClientProps) {
  const [users, setUsers] = useState<UserRecord[]>(initialUsers);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [selectedRolesMap, setSelectedRolesMap] = useState<{ [userId: string]: string }>({});

  // Initialize selected roles map from initial users
  useEffect(() => {
    const initialMap: { [userId: string]: string } = {};
    initialUsers.forEach((user) => {
      initialMap[user.id] = user.role || '';
    });
    setSelectedRolesMap(initialMap);
  }, [initialUsers]);

  // Refresh users list from API
  const refreshUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiRequest<{ users: UserRecord[] }>('/api/admin/users', {
        withAuth: true,
      });
      setUsers(response.users || []);
      // Update selected roles map
      const updatedMap: { [userId: string]: string } = {};
      (response.users || []).forEach((user) => {
        updatedMap[user.id] = user.role || '';
      });
      setSelectedRolesMap(updatedMap);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  // Handle role update
  const handleRoleUpdate = async (user: UserRecord) => {
    setUpdating(user.id);
    setError(null);
    try {
      await apiRequest(`/api/admin/users`, {
        method: 'PUT',
        body: { id: user.id, role: selectedRolesMap[user.id] },
        withAuth: true,
      });

      // Update local state
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role: selectedRolesMap[user.id] } : u))
      );
    } catch (err: any) {
      setError(err.message || 'Failed to update user role');
      // Revert the selected role on error
      setSelectedRolesMap((prev) => ({
        ...prev,
        [user.id]: user.role || '',
      }));
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header - reuse main app visual style but without Clear Chat button */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-white/20 p-3 sm:p-4">
        <div className="max-w-6xl mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: Avatar + title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 flex items-center justify-center shrink-0">
              <Image
                src="https://chatbotcdn.socialenable.co/vietjet-air/assets/images/amy-full-body.png"
                alt="TVJ Assistant"
                width={40}
                height={40}
                className="object-cover"
              />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-red-600 to-yellow-600 bg-clip-text text-transparent truncate">
                TVJ Internal Assistant
              </h1>
              <p className="text-[11px] sm:text-xs text-gray-500">
                Admin CMS · User Management
              </p>
            </div>
          </div>

          {/* Right: actions (Refresh + user dropdown for admin navigation) */}
          <div className="flex w-full sm:w-auto items-center justify-stretch sm:justify-end gap-2">
            <Button
              onClick={refreshUsers}
              disabled={loading}
              className="w-full sm:w-auto px-4 py-2"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </Button>
            <UserMenu
              items={[
                { label: 'Users', href: '/admin-cms/users', adminOnly: true },
                { label: 'Knowledge Base', href: '/admin-cms/knowleage-base', adminOnly: true },
                { label: 'Images', href: '/admin-cms/images', adminOnly: true },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="p-4 sm:p-8">
        <div className="max-w-6xl mx-auto bg-white/80 rounded-2xl shadow-xl p-4 sm:p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Users
            </h2>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-100/50 backdrop-blur-sm rounded-xl border border-red-200/50">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-y-2">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-600 bg-white/50">
                  <th className="py-3 px-4 break-words whitespace-normal">No</th>
                  <th className="py-3 px-4 break-words whitespace-normal">ID</th>
                  <th className="py-3 px-4 break-words whitespace-normal">Email</th>
                  <th className="py-3 px-4 break-words whitespace-normal">Display Name</th>
                  <th className="py-3 px-4 min-w-[12rem] break-words whitespace-normal">Role</th>
                  <th className="py-3 px-4 break-words whitespace-normal">Department</th>
                  <th className="py-3 px-4 break-words whitespace-normal">Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, index) => {
                  const selectedRole = selectedRolesMap[user.id] || user.role || '';
                  const roleChanged = selectedRole !== (user.role || '');

                  return (
                    <tr
                      key={user.id}
                      className="bg-white/70 rounded-lg shadow-sm transition hover:bg-white"
                    >
                      <td className="py-3 px-4 font-mono text-sm text-gray-800 break-words whitespace-normal">
                        {index + 1}
                      </td>
                      <td className="py-3 px-4 font-mono text-sm text-gray-800 break-words whitespace-normal">
                        {user.id}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-800 break-words whitespace-normal">
                        {user.email || '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-800 break-words whitespace-normal">
                        {user.displayName || '-'}
                      </td>
                      <td className="py-3 px-4 min-w-[12rem] break-words whitespace-normal">
                        <select
                          value={selectedRole}
                          onChange={(e) => {
                            setSelectedRolesMap((prev) => ({
                              ...prev,
                              [user.id]: e.target.value,
                            }));
                          }}
                          disabled={updating === user.id}
                          className="w-full border px-3 py-2 rounded-md text-sm text-gray-800 bg-white shadow-sm cursor-pointer disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed hover:border-blue-500"
                        >
                          <option value="">Select role...</option>
                          {ROLES.map((role) => (
                            <option key={role} value={role}>
                              {role.toUpperCase()}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-800 break-words whitespace-normal">
                        {user.department || '-'}
                      </td>
                      <td className="py-3 px-4 break-words whitespace-normal">
                        {roleChanged ? (
                          <Button
                            onClick={() => handleRoleUpdate(user)}
                            disabled={updating === user.id}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-1 rounded-md shadow transition w-auto"
                          >
                            {updating === user.id ? 'Saving...' : 'Update'}
                          </Button>
                        ) : (
                          <span className="text-green-500 text-sm">✓</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {users.length === 0 && !loading && (
            <div className="text-center py-8">
              <p className="text-gray-600">No users found.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

