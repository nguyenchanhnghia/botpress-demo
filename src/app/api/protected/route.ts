import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);

  if (user instanceof NextResponse) {
    return user; // Unauthorized
  }

  // User is authenticated
  return NextResponse.json({
    user,
    message: 'Access granted to protected resource'
  });
}
