import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import Users from '@/lib/aws/users';
import { ADMIN_ROLES } from '@/lib/constants/roles';

async function checkAdminAccess(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth; // unauthorized/err

  const requesterEmail = (auth as any).email;
  if (!requesterEmail) {
    return NextResponse.json({ error: 'Forbidden - missing email' }, { status: 403 });
  }

  const requesterRecord = await Users.findByEmail(requesterEmail);
  const role = requesterRecord?.role;
  if (!requesterRecord || !ADMIN_ROLES.includes(role as any)) {
    return NextResponse.json({ error: 'Forbidden - admin or super-admin required' }, { status: 403 });
  }

  return null; // Admin or super-admin access granted
}

export async function GET(req: NextRequest) {
  const adminCheck = await checkAdminAccess(req);
  if (adminCheck) return adminCheck;

  try {
    const list = await Users.list();
    return NextResponse.json({ users: list });
  } catch (err: any) {
    console.error('Error fetching users list:', err);
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const adminCheck = await checkAdminAccess(req);
  if (adminCheck) return adminCheck;

  try {
    const body = await req.json();
    const { id, role } = body;

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (!role || typeof role !== 'string') {
      return NextResponse.json({ error: 'Valid role is required' }, { status: 400 });
    }

    // Validate role is one of the allowed values
    const allowedRoles = ['ict', 'com', 'pd', 'admin', 'super-admin'];
    if (!allowedRoles.includes(role.toLowerCase())) {
      return NextResponse.json({ error: `Invalid role. Must be one of: ${allowedRoles.join(', ')}` }, { status: 400 });
    }

    // Update user role
    const updatedUser = await Users.update(id, { role: role.toLowerCase() });

    return NextResponse.json({
      success: true,
      user: updatedUser
    });
  } catch (err: any) {
    console.error('Error updating user role:', err);
    return NextResponse.json({
      error: err?.message || 'Internal server error'
    }, { status: 500 });
  }
}
