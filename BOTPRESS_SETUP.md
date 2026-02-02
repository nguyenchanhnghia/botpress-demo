# Botpress Integration Setup

This project uses **direct HTTP integration** with Botpress Cloud (instead of relying on browser-only SDKs) to avoid SSR issues and to keep auth/keys on the server where appropriate.

There are two Botpress “surfaces” used in this repo:

## 1) Chat runtime API (used by `/botChat`)

The chat UI calls the Botpress **runtime** endpoints under:

- `BOTPRESS_BASE_URL` (example: `https://chat.botpress.cloud/<botId>`)

Client-side calls are made via `botpressAPI` in `src/lib/ldap-auth.ts`:
- `POST /users/get-or-create`
- `POST /conversations/get-or-create`
- `GET /conversations/{id}`
- `GET /conversations/{id}/messages`
- `POST /messages`
- `GET /conversations/{id}/listen` (SSE)

### Authentication for runtime calls (x-user-key)

The chat runtime uses an `x-user-key` header. In this app:

- The **server** sets a readable `x-user-key` cookie during login callback (`/api/auth/callback`)
- The **client** reads that cookie and sends it in requests to Botpress runtime

Do **not** hardcode tokens/keys in code or documentation.

## 2) Botpress Cloud Management API (used for Knowledge Base file tagging)

The admin CMS pages for Knowledge Base (`/admin-cms/knowleage-base` and `/admin-cms`) call a backend proxy:

- `GET /api/botpress/files`
- `PUT /api/botpress/files`

Those proxy routes call the Botpress Cloud **management** API:

- `BOT_PRESS_CLOUD_API_URL` (typically `https://api.botpress.cloud`)
- Path prefix: `/v1`

Required headers used by the proxy:
- `Authorization: Bearer ${BOTPRESS_TOKEN}`
- `x-bot-id: ${BOT_ID}`
- `x-user-key: <from cookie or request header>`

## Server-side user provisioning (optional)

On first login, `GET /api/auth/callback` may:
- look up the user in DynamoDB
- if missing, create a Botpress user via `POST ${BOTPRESS_BASE_URL}/users` using a **service key** (`BOTPRESS_API_USER_KEY` / `DEFAULT_BOTPRESS_KEY`)
- store the Botpress key/user linkage in DynamoDB

This allows stable per-user keys and role-based admin behavior across sessions.

## Environment variables

### Required for KB file tagging

- `BOT_PRESS_CLOUD_API_URL` (example: `https://api.botpress.cloud`)
- `BOTPRESS_TOKEN`
- `BOT_ID`

### Required for chat runtime

- `BOTPRESS_BASE_URL` (example: `https://chat.botpress.cloud/<botId>`)

### Optional (server-side provisioning + fallback)

- `BOTPRESS_API_USER_KEY` (service key)
- `DEFAULT_BOTPRESS_KEY` (fallback key if provisioning fails)
- `BOTPRESS_USER_KEY` (legacy fallback used by some routes if no cookie/header is present)

## Troubleshooting

- **Chat can’t connect / SSE fails**
  - Check network connectivity and Botpress runtime base URL (`BOTPRESS_BASE_URL`).
  - Verify `x-user-key` cookie is present after login.
- **KB list/update fails**
  - Verify `BOTPRESS_TOKEN`, `BOT_ID`, and `BOT_PRESS_CLOUD_API_URL`.
- **403/401 from proxy routes**
  - Ensure you are logged in (valid `auth_token`) and, for admin pages, that your DynamoDB role is `admin`/`super-admin`.
