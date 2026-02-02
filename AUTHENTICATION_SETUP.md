# Authentication Setup (OIDC/PKCE + DynamoDB Roles)

This project uses **OIDC Authorization Code + PKCE** against the company “LDAP Auth” identity provider.

There is **no username/password authentication stored in MongoDB** in this repo. Roles are resolved from **DynamoDB** after login.

## High-level flow

1. User opens `/login`
2. Frontend redirects to `GET /api/auth/login`
3. Server generates PKCE verifier/challenge and redirects to the IdP authorize endpoint
4. IdP redirects back to `GET /api/auth/callback?code=...`
5. Callback exchanges code → `id_token` and sets cookies:
   - `auth_token` (**HttpOnly**): used for server-side authorization
   - `user_data` (readable): UI convenience (displayName/email/role/etc.)
   - `x-user-key` (readable): Botpress user key used by the chat UI
6. Client initializes session by calling `GET /api/protected`, which:
   - validates `auth_token`
   - merges role/profile data from DynamoDB
   - updates `user_data` cookie

## Required environment variables

Configure in `.env.local` (or `.env.uat` / `.env.prod`):

### OIDC / LDAP Auth

- `APP_URL`
  - Example: `http://localhost:3001`
  - Used to compute the default redirect URI.
- `LDAP_AUTH_URL`
  - Example: `https://ldap-auth.example.com`
  - This is used as the base for `/authorize` and `/token`.
- `LDAP_CLIENT_ID`
  - Client ID registered at the IdP.
- `LDAP_REDIRECT_URI` (optional)
  - If not set, the app defaults to `${APP_URL}/api/auth/callback`.
- `APP_ENV` (optional)
  - Used by chat bootstrapping payloads (e.g. `uat`, `prod`).

## Cookies

These are the main cookies used by the app:

- `auth_token` (**HttpOnly**)
  - Contains the OIDC ID token (JWT)
  - Read server-side by `requireAuth` in `src/lib/auth-middleware.ts`
- `user_data` (readable)
  - JSON user object for client UI (role/displayName/etc.)
- `x-user-key` (readable)
  - Botpress user key used by client chat calls
- `pkce_code_verifier` (**HttpOnly**, short-lived)
  - Temporary PKCE verifier used only during the callback exchange

## Key routes

### Auth routes

- `GET /api/auth/login`
  - Starts the OIDC/PKCE flow
  - Writes `pkce_code_verifier` (HttpOnly) and redirects to IdP
- `GET /api/auth/callback`
  - Exchanges code → token, resolves Botpress key + DynamoDB user record, sets cookies, redirects to `/botChat`
- `POST /api/auth/logout`
  - Clears cookies

### Protected endpoints

- `GET /api/protected`
  - Validates the session and refreshes role/profile data from DynamoDB
- `GET /api/config`
  - Returns a **safe** subset of runtime config for the browser
  - This endpoint is protected (requires a valid session)

## Adding a protected API route

Use `requireAuth`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (user instanceof NextResponse) return user; // 401/500

  return NextResponse.json({ ok: true, user });
}
```

## Role-based access (admin)

Admin-only APIs (e.g. `/api/admin/*`) resolve the caller’s role from DynamoDB and check it against:

- `ADMIN_ROLES` in `src/lib/constants/roles.ts` (currently `admin` and `super-admin`)

Example check pattern is implemented in:

- `src/app/api/admin/users/route.ts`
- `src/app/api/admin/images/route.ts`
- `src/app/api/admin/images/upload/route.ts`

## Troubleshooting

- **Login loops / redirects**
  - Ensure `APP_URL` matches the actual origin you are using in the browser.
  - Ensure the IdP client config allows the redirect URI.
- **401 from `/api/protected`**
  - Session expired or invalid token; re-login.
- **Admin pages show access denied**
  - The user exists but role in DynamoDB is not `admin`/`super-admin`.
