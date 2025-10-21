import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  console.log(`🔍 Middleware: Processing ${pathname}`);

  // Skip API routes
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Get the auth token from cookies
  const token = request.cookies.get('auth_token')?.value;
  console.log(`🍪 Middleware: Token exists: ${!!token}`);

  // Simple logic: If no token, redirect to login (except for login page)
  if (!token) {
    if (pathname === '/login') {
      console.log(`✅ Middleware: Allowing access to login page`);
      return NextResponse.next();
    }
    console.log(`🔄 Middleware: No token - redirecting to login`);
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // If user has token and is on login page, redirect to botChat
  if (pathname === '/login') {
    console.log(`🔄 Middleware: Has token - redirecting to botChat`);
    return NextResponse.redirect(new URL('/botChat', request.url));
  }

  // If user has token and is on home page, redirect to botChat
  if (pathname === '/') {
    console.log(`🔄 Middleware: Has token - redirecting to botChat`);
    return NextResponse.redirect(new URL('/botChat', request.url));
  }

  console.log(`✅ Middleware: Allowing access to ${pathname}`);
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/dashboard',
    '/login'
  ],
};
