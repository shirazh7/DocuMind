# API Authentication Guide

## Overview

Acme Engineering's API uses a multi-layered authentication system combining OAuth 2.0, API keys, and role-based access control (RBAC). This guide covers authentication flows, token management, rate limiting, and security best practices.

## Authentication Methods

### OAuth 2.0 (Authorization Code Flow)

Our primary authentication method for user-facing applications follows the OAuth 2.0 Authorization Code flow:

1. **Authorization Request**: Client redirects user to `https://auth.acme.dev/authorize` with:
   - `client_id`: Your application's client ID
   - `redirect_uri`: Your registered callback URL
   - `response_type`: `code`
   - `scope`: Requested permissions (e.g., `read:docs write:docs admin`)
   - `state`: CSRF protection token

2. **User Authorization**: User authenticates and grants permissions

3. **Authorization Code**: Acme redirects back to `redirect_uri` with an authorization code

4. **Token Exchange**: Client exchanges the code for tokens via:

```bash
POST https://auth.acme.dev/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=<authorization_code>
&client_id=<client_id>
&client_secret=<client_secret>
&redirect_uri=<redirect_uri>
```

5. **Response**: Returns access token, refresh token, and token metadata

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "refresh_token": "dGhpcyBpcyBhIHJlZnJl...",
  "token_type": "Bearer",
  "expires_in": 86400,
  "scope": "read:docs write:docs"
}
```

### API Key Authentication

For server-to-server communication, use API keys:

```bash
GET https://api.acme.dev/v1/documents
X-API-Key: ak_live_xxxxxxxxxxxxxxxxxxxx
```

API keys are generated from the **Developer Portal** at `https://portal.acme.dev/api-keys`. Each key:

- Is scoped to a specific environment (development, staging, production)
- Can be restricted to specific IP addresses
- Has configurable permissions matching RBAC roles
- Must be rotated every **90 days**

### Bearer Token

Include the access token in all API requests:

```bash
GET https://api.acme.dev/v1/documents
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
```

## Token Management

### Access Token

- **Expiry**: **24 hours** from issuance
- **Format**: JWT signed with RS256
- **Claims**: `sub` (user ID), `scope` (permissions), `exp` (expiry), `iss` (issuer)

### Refresh Token

- **Expiry**: **30 days** from issuance
- **Usage**: Single-use; a new refresh token is issued with each refresh
- **Storage**: Must be stored securely (encrypted at rest, never in localStorage)

### Token Refresh

To refresh an expired access token:

```bash
POST https://auth.acme.dev/refresh
Content-Type: application/json

{
  "grant_type": "refresh_token",
  "refresh_token": "dGhpcyBpcyBhIHJlZnJl...",
  "client_id": "<client_id>"
}
```

The refresh endpoint is also available at `POST /auth/refresh` for backward compatibility.

Response:

```json
{
  "access_token": "new_access_token...",
  "refresh_token": "new_refresh_token...",
  "expires_in": 86400
}
```

### Token Revocation

To revoke a token (e.g., on user logout):

```bash
POST https://auth.acme.dev/revoke
Content-Type: application/json

{
  "token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type_hint": "access_token"
}
```

## Rate Limiting

### Default Limits

| Plan | Rate Limit | Burst Limit |
|------|-----------|-------------|
| Free | 100 req/min | 20 req/sec |
| Pro | 1,000 req/min | 100 req/sec |
| Enterprise | 10,000 req/min | 500 req/sec |

### Rate Limit Headers

Every API response includes rate limit information:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 985
X-RateLimit-Reset: 1640000000
```

### Handling Rate Limits

When rate limited, the API returns:

```json
{
  "error": "rate_limit_exceeded",
  "message": "Too many requests. Please retry after 60 seconds.",
  "retry_after": 60
}
```

HTTP Status: `429 Too Many Requests`

Best practice: Implement exponential backoff with jitter when retrying rate-limited requests.

## RBAC Roles

### Role Hierarchy

| Role | Permissions | Description |
|------|------------|-------------|
| **Admin** | Full access | Can manage users, API keys, and all resources |
| **Developer** | Read/write | Can create, read, update, and delete documents and APIs |
| **Viewer** | Read-only | Can only read documents and view dashboards |

### Assigning Roles

Roles are assigned through the Admin Dashboard or via the API:

```bash
POST https://api.acme.dev/v1/users/{user_id}/roles
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "role": "developer",
  "scope": "project:acme-web"
}
```

### Permission Scopes

Permissions follow the format `action:resource`:

- `read:docs` — Read documents
- `write:docs` — Create and update documents
- `delete:docs` — Delete documents
- `admin` — Full administrative access
- `read:analytics` — View analytics dashboards
- `manage:users` — Manage user accounts and roles

## Security Best Practices

1. **Never expose API keys or tokens in client-side code** — use environment variables
2. **Always use HTTPS** — all API endpoints enforce TLS 1.2+
3. **Implement token rotation** — rotate API keys every 90 days
4. **Use the principle of least privilege** — assign the minimum required role
5. **Monitor API usage** — review access logs weekly for anomalies
6. **Enable MFA** — all admin accounts require multi-factor authentication
