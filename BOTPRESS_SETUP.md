# Botpress Integration Setup

## Overview
This project now uses direct Botpress Cloud API integration instead of the @botpress/chat client library to avoid SSR issues.

## Flow
1. **User Login** → Sets `x-user-key` cookie with JWT token
2. **Get/Create User** → Calls Botpress API to get or create user
3. **Get/Create Conversation** → Creates or retrieves existing conversation
4. **Load Messages** → Fetches existing conversation messages
5. **Send Messages** → POST to Botpress messages endpoint
6. **Listen for Responses** → SSE connection for real-time updates

## API Endpoints Used

### Base URL
```
https://chat.botpress.cloud/9c1b585b-b19e-4c07-ba48-cbf53b2cb6e8
```

### Endpoints
- `POST /users/get-or-create` - Get or create user
- `POST /conversations/get-or-create` - Get or create conversation
- `GET /messages?conversationId={id}` - List messages
- `POST /messages` - Send message
- `GET /conversations/{id}/listen` - Listen for new messages (SSE)

## Authentication
- Uses `x-user-key` header with JWT token
- Token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InVzZXJfMDFKWjU3S0Y1UTlLQ0FBNU1HRFNRUkJYRDEiLCJpYXQiOjE3NTE1MTE2MzR9.l2_g9TA6QcOuKCOp8NykOHF9IpX64STtk_hBf3zAAaI`

## Message Format
```json
{
  "payload": {
    "text": "example",
    "type": "text"
  },
  "conversationId": "example"
}
```

## Features
- ✅ Direct API integration (no SSR issues)
- ✅ Real-time message listening via SSE
- ✅ Conversation persistence
- ✅ User authentication
- ✅ Message history
- ✅ Error handling
- ✅ Loading states

## Troubleshooting

### Common Issues
1. **CORS errors** - Ensure Botpress webhook is configured correctly
2. **SSE connection issues** - Check network connectivity
3. **Authentication errors** - Verify x-user-key is set correctly

### Development
- Run `npm run dev` to start development server
- Check browser console for API calls and errors
- Monitor network tab for request/response details 