/**
 * User role constants for role-based access control
 */

/** All available user roles */
export const USER_ROLES = {
  ICT: 'ict',
  COM: 'com',
  PD: 'pd',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super-admin',
} as const;

/** Array of all roles */
export const ALL_ROLES = Object.values(USER_ROLES);

/** Roles that have admin privileges (can access admin pages and APIs) */
export const ADMIN_ROLES = [USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN] as const;

/** Type for admin roles */
export type AdminRole = typeof ADMIN_ROLES[number];

/** Type for all user roles */
export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

/**
 * Check if a role has admin privileges
 */
export function isAdminRole(role: string | undefined | null): boolean {
  return role ? ADMIN_ROLES.includes(role as AdminRole) : false;
}


