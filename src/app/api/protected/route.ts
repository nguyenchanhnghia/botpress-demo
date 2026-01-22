import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import Users from '@/lib/aws/users';
import { serverRuntimeConfig } from '@/lib/runtime-config/server';

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);

  if (user instanceof NextResponse) {
    return user; // Unauthorized
  }

  // Fetch latest user data from DynamoDB and update user profile
  let userRecord: any = null;
  try {
    // Use email to find user in DynamoDB
    const userEmail = user.email;
    if (userEmail) {
      userRecord = await Users.findByEmail(userEmail);
      console.log('userRecord from findByEmail', userRecord);
      const findById = await Users.findById(userRecord.user_id);
      console.log('findById', findById);
      // Console log user info from DynamoDB
      console.log('[api/protected] User info from DynamoDB:', {
        id: userRecord?.id,
        email: userRecord?.email,
        displayName: userRecord?.displayName,
        role: userRecord?.role,
        department: userRecord?.department,
        title: userRecord?.title,
        company: userRecord?.company,
        createdAt: userRecord?.createdAt,
        fullRecord: userRecord
      });
    }
  } catch (err) {
    console.error('Error fetching user data from DynamoDB:', err);
    // Continue without updated data - user is still authenticated
  }

  // Merge user data from token with latest data from DynamoDB
  // DynamoDB data takes precedence for fields that exist there
  const updatedUser: any = {
    ...user,
    // Update with latest data from DynamoDB if available
    ...(userRecord ? {
      role: userRecord.role,
      displayName: userRecord.displayName || user.displayName,
      department: userRecord.department || user.department,
      title: userRecord.title || user.title,
      company: userRecord.company || (user as any).company,
      givenName: userRecord.givenName || (user as any).givenName,
      // Keep token-based fields if not in DynamoDB
      sub: user.sub,
      email: user.email || userRecord.email,
    } : {
      // If no DynamoDB record, just include role if it was already in the token
      role: (user as any).role,
    }),
  };

  // Create response
  const response = NextResponse.json({
    user: updatedUser,
    message: 'Access granted to protected resource'
  });

  // Update user_data cookie with latest profile data from DynamoDB
  if (userRecord) {
    const runtime = serverRuntimeConfig;
    const userDataForCookie = {
      ...updatedUser,
      key: userRecord.key || (user as any).key, // Include Botpress key if available
    };

    response.cookies.set('user_data', JSON.stringify(userDataForCookie), {
      httpOnly: false,
      path: '/',
      sameSite: 'lax',
      secure: runtime.cookieConfig.secure,
      maxAge: 60 * 60 * 24 * runtime.cookieConfig.expiresDays,
    });
  }

  return response;
}
