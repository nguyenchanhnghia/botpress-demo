## TVJ Internal AI Assistant (Banh Mi) – Frontend

This is a **Next.js 15 (App Router)** web app for VietJet Thailand’s internal assistant:
- **Chat UI** backed by **Botpress Cloud** (`/botChat`)
- **Admin CMS** for **Users/Roles**, **Knowledge Base file role tags**, and **Images** (`/admin-cms/*`)
- **Authentication** via **OIDC/PKCE** against the company “LDAP Auth” identity provider
- **Roles/user records** stored in **DynamoDB**
- **Images** uploaded to **S3** and indexed in **DynamoDB**, displayed using **presigned URLs**

## Quick start

```bash
npm ci
npm run dev
```

Dev server runs on **`http://localhost:3001`** (see `package.json`).

## Main routes

- **Login**: `/login`
- **Chat**: `/botChat`
- **Admin CMS**
  - `/admin-cms/users`
  - `/admin-cms/knowleage-base`
  - `/admin-cms/images`

## Authentication flow (high level)

- `/login` → `GET /api/auth/login`
- `GET /api/auth/login` generates **PKCE** and redirects to the IdP authorize endpoint
- IdP redirects back to `GET /api/auth/callback`
- Callback exchanges the code for an ID token and sets cookies:
  - **`auth_token`** (**HttpOnly**) – used for server-side authorization
  - **`user_data`** (readable) – used by client UI
  - **`x-user-key`** (readable) – used by client Botpress calls
- `GET /api/protected` validates the session and refreshes role/profile from DynamoDB

## Roles

Roles are stored in DynamoDB and used for gating admin pages/APIs:
- Standard: `ict`, `com`, `pd`
- Admin: `admin`, `super-admin`

## Environment variables (summary)

Configure in `.env.local` (or `.env.uat` / `.env.prod`).

### App / OIDC

- `APP_URL` (default `http://localhost:3001`)
- `APP_ENV` (e.g. `uat`, `prod`)
- `LDAP_AUTH_URL`
- `LDAP_CLIENT_ID`
- `LDAP_REDIRECT_URI` (optional; defaults to `${APP_URL}/api/auth/callback`)

### Botpress

- `BOTPRESS_BASE_URL` (chat runtime base, e.g. `https://chat.botpress.cloud/<botId>`)
- `BOT_PRESS_CLOUD_API_URL` (management API origin, typically `https://api.botpress.cloud`)
- `BOT_ID`
- `BOTPRESS_TOKEN` (server-side token for Botpress Cloud APIs)
- `BOTPRESS_API_USER_KEY` / `DEFAULT_BOTPRESS_KEY` (service key used server-side to create Botpress users)

### AWS (DynamoDB + S3)

- `AWS_REGION`
- `USERS_TABLE`, `USERS_EMAIL_INDEX` (or `USERS_EMAIL_GSI`), `USERS_TABLE_PK`
- `FILES_TABLE`, `FILES_TABLE_PK`
- `S3_BUCKET_NAME`
- `CURATOR_ROLE_ARN` (assume-role used for uploads + presigned URLs)

## Useful API routes

- **Auth**: `/api/auth/login`, `/api/auth/callback`, `/api/auth/logout`
- **Session check**: `/api/protected`
- **Runtime config (protected)**: `/api/config`
- **Admin**
  - `/api/admin/users` (list/update roles)
  - `/api/admin/images` (list)
  - `/api/admin/images/upload` (upload)
  - `/api/admin/images/presigned-url` (preview URLs)
- **Botpress (KB tagging)**: `/api/botpress/files`

## Security notes

- **Do not commit tokens/keys** in markdown files or code. If credentials were committed, rotate them and move them to environment variables.
