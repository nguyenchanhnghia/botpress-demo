import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import Files from '@/lib/aws/files';
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

/**
 * GET /api/admin/images
 * List all images from DynamoDB
 */
export async function GET(req: NextRequest) {
  const adminCheck = await checkAdminAccess(req);
  if (adminCheck) return adminCheck;

  try {
    const files = await Files.list();
    return NextResponse.json({
      success: true,
      images: files,
    });
  } catch (err: any) {
    console.error('Error fetching images list:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch images' },
      { status: 500 }
    );
  }
}


