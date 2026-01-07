'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/components/auth/UserContext';

export interface UserMenuItem {
  label: string;
  href?: string;
  onClick?: () => void;
  adminOnly?: boolean; // If true, only show for admin/super-admin
}

interface UserMenuProps {
  items: UserMenuItem[];
}

export default function UserMenu({ items }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const { user, loading } = useUser();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleItemClick = (item: UserMenuItem) => {
    if (item.onClick) {
      item.onClick();
    }
    if (item.href) {
      router.push(item.href);
    }
    setOpen(false);
  };

  // Filter items based on role - show admin items only if user is admin or super-admin
  const userRole = user?.role?.toLowerCase()?.trim();
  const isAdmin = userRole === 'admin' || userRole === 'super-admin';

  // Get first letter of email or displayName for icon
  const getUserInitial = (): string => {
    if (!user) return 'U';
    const name = user.displayName || user.email || '';
    if (name.length > 0) {
      return name.charAt(0).toUpperCase();
    }
    return 'U';
  };

  // Debug logging (remove in production if needed)
  useEffect(() => {
    if (!loading && user) {
      console.log('[UserMenu] Current user info:', {
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        userRole,
        isAdmin,
        fullUser: user
      });
    }
  }, [user, userRole, isAdmin, loading]);

  // Filter items: hide admin-only items unless user is confirmed admin/super-admin
  // While loading, hide admin items to prevent showing them to non-admin users
  const visibleItems = items.filter(item => {
    if (item.adminOnly) {
      // Only show admin items if user is loaded and confirmed as admin/super-admin
      const shouldShow = !loading && isAdmin;
      return shouldShow;
    }
    // Always show non-admin items
    return true;
  });

  if (!visibleItems || visibleItems.length === 0) return null;

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-md hover:shadow-lg hover:brightness-105 transition-all focus:outline-none"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold">{getUserInitial()}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-44 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black/5 focus:outline-none z-50">
          <div className="py-1">
            {visibleItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => handleItemClick(item)}
                className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


