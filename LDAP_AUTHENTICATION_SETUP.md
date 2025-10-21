# LDAP Authentication Setup

This project now uses LDAP authentication via the `ldap_auth` service instead of MongoDB-based authentication.

## Features

- **LDAP Integration**: Authenticates users against LDAP server
- **OAuth 2.0 + PKCE Flow**: Secure authentication using OAuth 2.0 with PKCE
- **JWT Token Management**: Uses JWT tokens for session management
- **Automatic Token Expiration**: Handles token expiration and redirects to login
- **Secure Cookies**: Stores authentication data in secure HTTP-only cookies
- **Session Management**: Automatic session monitoring and cleanup

## Architecture

### Authentication Flow

1. User clicks "Sign in with LDAP" on login page
2. Frontend redirects to LDAP auth service `/authorize` endpoint
3. User enters LDAP credentials on auth service
4. Auth service validates credentials and issues authorization code
5. Frontend exchanges authorization code for JWT token
6. JWT token is stored in secure cookies
7. User is redirected to dashboard

### Token Management

- **JWT Tokens**: Signed by LDAP auth service using RS256
- **Token Verification**: Frontend verifies tokens using JWKS endpoint
- **Expiration Handling**: Automatic detection and handling of expired tokens
- **Session Monitoring**: Background monitoring for token expiration

## Configuration

### Environment Variables

Create a `.env.local` file with the following variables:

```env
# LDAP Authentication Service Configuration
NEXT_PUBLIC_LDAP_AUTH_URL=https://zu4airs4fpwj2t2pxln6uweupa0qsryn.lambda-url.ap-southeast-1.on.aws
NEXT_PUBLIC_CLIENT_ID=vz-wiki-frontend
NEXT_PUBLIC_REDIRECT_URI=http://localhost:3001/api/auth/callback

# Development Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

**For Production:**
```env
NEXT_PUBLIC_LDAP_AUTH_URL=https://zu4airs4fpwj2t2pxln6uweupa0qsryn.lambda-url.ap-southeast-1.on.aws
NEXT_PUBLIC_CLIENT_ID=vz-wiki-frontend
NEXT_PUBLIC_REDIRECT_URI=https://your-frontend-domain.com/api/auth/callback
NEXT_PUBLIC_APP_URL=https://your-frontend-domain.com
```

### LDAP Auth Service Setup

The LDAP auth service must be running and configured with:

1. **Client Registration**: Register the frontend as a client
2. **Redirect URI**: Configure allowed redirect URIs
3. **JWKS Endpoint**: Ensure JWKS endpoint is accessible
4. **LDAP Configuration**: Configure LDAP server connection

## API Endpoints

### Authentication

- `GET /login` - Login page with LDAP redirect
- `GET /api/auth/callback` - OAuth callback handler
- `POST /api/auth/logout` - Logout and clear cookies
- `GET /api/protected` - Protected endpoint example

### Protected Routes

All routes except `/login` and `/api/auth/callback` require authentication.

## Usage

### Client-Side Authentication

```typescript
import { auth, ldapAuth } from '@/lib/ldap-auth';

// Check if user is authenticated
if (auth.isAuthenticated()) {
  // User is logged in
  const user = auth.getCurrentUser();
  console.log(user);
}

// Get authorization URL for login
const authUrl = ldapAuth.getAuthorizationUrl();
window.location.href = authUrl;

// Logout
await auth.logout();
```

### Server-Side Authentication

```typescript
import { requireAuth } from '@/lib/auth-middleware';

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  
  if (user instanceof NextResponse) {
    return user; // Unauthorized
  }
  
  // User is authenticated
  return NextResponse.json({ user });
}
```

## Security Features

- **PKCE (Proof Key for Code Exchange)**: Prevents authorization code interception
- **JWT Verification**: All tokens are verified using JWKS
- **Secure Cookies**: HTTP-only, secure, same-site cookies
- **Token Expiration**: Automatic handling of expired tokens
- **CSRF Protection**: Same-site cookie policy prevents CSRF attacks

## Token Expiration Handling

The system automatically handles token expiration:

1. **Background Monitoring**: Checks token status every 5 minutes
2. **Page Visibility**: Checks token when page becomes visible
3. **Middleware Protection**: Server-side token validation
4. **Automatic Redirect**: Redirects to login on expiration

## File Structure

```
src/
├── lib/
│   ├── ldap-auth.ts          # LDAP authentication utilities
│   ├── auth-middleware.ts    # Server-side auth middleware
│   ├── token-refresh.ts      # Token expiration handling
│   ├── config.ts             # Configuration
│   └── auth.ts               # Legacy compatibility
├── app/
│   ├── api/
│   │   └── auth/
│   │       ├── callback/     # OAuth callback handler
│   │       └── logout/       # Logout handler
│   ├── login/                # Login page
│   ├── dashboard/            # Protected dashboard
│   └── page.tsx              # Root redirect
└── middleware.ts              # Route protection
```

## Development

### Starting the Services

1. **Start LDAP Auth Service**:
   ```bash
   cd ldap_auth
   npm run start:dev
   ```

2. **Start Frontend**:
   ```bash
   cd vz_wiki_front_end
   npm run dev
   ```

### Testing Authentication

1. Navigate to `http://localhost:3001`
2. Click "Sign in with LDAP"
3. Enter LDAP credentials
4. Verify redirect to dashboard
5. Test logout functionality

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure LDAP auth service allows frontend origin
2. **Token Verification Fails**: Check JWKS endpoint accessibility
3. **Redirect Loops**: Verify redirect URI configuration
4. **Cookie Issues**: Check secure cookie settings in production

### Debug Mode

Enable debug logging by adding to your environment:

```env
NODE_ENV=development
```

### Token Debugging

```typescript
// Check token status
const token = auth.getToken();
const isExpired = ldapAuth.isTokenExpired(token);
console.log('Token expired:', isExpired);
```

## Migration from MongoDB

The following changes were made during migration:

- ✅ Removed MongoDB dependencies
- ✅ Removed database initialization scripts
- ✅ Replaced MongoDB auth with LDAP auth
- ✅ Updated authentication flow
- ✅ Added token expiration handling
- ✅ Maintained Botpress integration
- ✅ Preserved session management

## Production Deployment

### Environment Configuration

**For Vercel Deployment:**
```env
NEXT_PUBLIC_LDAP_AUTH_URL=https://zu4airs4fpwj2t2pxln6uweupa0qsryn.lambda-url.ap-southeast-1.on.aws
NEXT_PUBLIC_CLIENT_ID=vz-wiki-frontend
NEXT_PUBLIC_REDIRECT_URI=https://your-vercel-app.vercel.app/api/auth/callback
NEXT_PUBLIC_APP_URL=https://your-vercel-app.vercel.app
```

**For Custom Domain:**
```env
NEXT_PUBLIC_LDAP_AUTH_URL=https://zu4airs4fpwj2t2pxln6uweupa0qsryn.lambda-url.ap-southeast-1.on.aws
NEXT_PUBLIC_CLIENT_ID=vz-wiki-frontend
NEXT_PUBLIC_REDIRECT_URI=https://wiki.yourdomain.com/api/auth/callback
NEXT_PUBLIC_APP_URL=https://wiki.yourdomain.com
```

### Security Considerations

- Use HTTPS in production
- Configure secure cookie settings
- Set up proper CORS policies
- Monitor token expiration
- Implement rate limiting
- Use secure LDAP connections
