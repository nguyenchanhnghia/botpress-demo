# MongoDB Authentication Setup

This project uses MongoDB for user authentication with access tokens stored in the database.

## Features

- **Secure Authentication**: Passwords are hashed using bcrypt
- **Role-based Access**: Users have roles (admin, ict, com, pd)
- **HTTP-only Cookies**: Access tokens are stored in secure HTTP-only cookies
- **Server-side Validation**: All authentication is validated on the server
- **Protected API Routes**: Middleware protects API endpoints

## Setup

### 1. Environment Variables

Create a `.env.local` file with:

```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>
```

### 2. Initialize Database

Run the database initialization script to create default users:

```bash
npm run init-db
```

This creates the following users:
- `admin/password` (admin role)
- `ict/password` (ict role)
- `com/password` (com role)
- `pd/password` (pd role)

### 3. Start Development Server

```bash
npm run dev
```

## API Endpoints

### Authentication

- `POST /api/auth/login` - Login with username/password
- `POST /api/auth/logout` - Logout and clear access token
- `POST /api/auth/register` - Register new user (admin only)

### Protected Routes

- `GET /api/protected` - Example protected endpoint
- Any route using `requireAuth` middleware

## Usage

### Client-Side Authentication

```typescript
import { authenticateUser, logoutUser, checkAuthStatus } from '@/lib/auth';

// Login
const result = await authenticateUser('admin', 'password');
if (result) {
  // User is logged in
  console.log(result.user);
}

// Check auth status
const user = await checkAuthStatus();
if (user) {
  // User is authenticated
}

// Logout
await logoutUser();
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

## Database Schema

### Users Collection

```javascript
{
  _id: ObjectId,
  username: String,
  passwordHash: String, // bcrypt hash
  role: String, // 'admin', 'ict', 'com', 'pd'
  accessToken: String, // UUID
  email: String,
  createdAt: Date
}
```

## Security Features

- **Password Hashing**: bcrypt with 12 salt rounds
- **HTTP-only Cookies**: Access tokens cannot be accessed by JavaScript
- **Server-side Validation**: All authentication checks happen on the server
- **Token Rotation**: New access token generated on each login
- **Secure Headers**: Proper cookie security settings

## File Structure

```
src/
├── lib/
│   ├── auth.ts              # Client-side auth utilities
│   ├── auth-middleware.ts   # Server-side auth middleware
│   ├── mongo.ts             # MongoDB connection
│   └── api.ts               # API request utilities
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/
│   │   │   │   └── route.ts
│   │   │   ├── logout/
│   │   │   │   └── route.ts
│   │   │   └── register/
│   │   │       └── route.ts
│   │   └── protected/
│   │       └── route.ts
│   └── ...
└── scripts/
    └── init-db.js          # Database initialization
```

## Adding New Protected Routes

1. Import the middleware:
```typescript
import { requireAuth } from '@/lib/auth-middleware';
```

2. Use it in your route:
```typescript
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (user instanceof NextResponse) return user;
  
  // Your protected logic here
}
```

## Role-based Access Control

Check user roles in your API routes:

```typescript
if (user.role !== 'admin') {
  return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
}
```

## Troubleshooting

### Common Issues

1. **MongoDB Connection Error**: Check your `MONGODB_URI` environment variable
2. **Authentication Fails**: Ensure the database is initialized with `npm run init-db`
3. **Cookie Issues**: Check that cookies are enabled and the domain is correct

### Debug Mode

Add logging to see authentication flow:

```typescript
// In auth-middleware.ts
console.log('Access token:', accessToken);
console.log('User found:', user);
``` 