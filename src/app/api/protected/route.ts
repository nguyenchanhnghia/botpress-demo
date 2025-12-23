import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import Users from '@/lib/aws/users';

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);

  if (user instanceof NextResponse) {
    return user; // Unauthorized
  }

  // Fetch user role from DynamoDB
  let role: string | undefined;
  try {
    const userEmail = (user as any).email;
    if (userEmail) {
      const userRecord = await Users.findByEmail(userEmail);
      role = userRecord?.role;
    }
  } catch (err) {
    console.error('Error fetching user role:', err);
    // Continue without role - user is still authenticated
  }

  // User is authenticated - include role if available
  return NextResponse.json({
    user: {
      ...user,
      role,
    },
    message: 'Access granted to protected resource'
  });
}
