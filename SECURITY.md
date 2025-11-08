# Security Implementation Guide

This document outlines the security measures implemented in OpenChat to protect against common web vulnerabilities.

## Overview

The following security improvements have been implemented:

1. **Rate Limiting** - Prevents brute force attacks
2. **CSRF Protection** - Prevents cross-site request forgery
3. **Route Protection** - Middleware-level authentication
4. **Input Validation** - Zod schemas for all API inputs
5. **Security Headers** - Protection against XSS, clickjacking, etc.

---

## 1. Rate Limiting

### Auth Endpoints

**File:** `/apps/web/src/app/api/auth/[...all]/route.ts`

**Implementation:**
- IP-based rate limiting on all authentication endpoints
- Default: 10 requests per minute (configurable via `AUTH_RATE_LIMIT`)
- Prevents brute force password attacks
- Returns 429 status with `Retry-After` header when limited

**Configuration:**
```bash
# .env
AUTH_RATE_LIMIT=10              # Max requests per window
AUTH_RATE_WINDOW_MS=60000       # Time window in milliseconds (1 minute)
```

**Features:**
- Automatic cleanup of expired rate limit buckets
- Memory leak prevention with max bucket limits
- Rate limit headers in all responses

### Chat Endpoints

**File:** `/apps/web/src/app/api/chats/route.ts`

**Implementation:**
- Session-token-based rate limiting for chat creation
- Prevents timing attacks by checking rate limit before user validation
- Default: 10 chats per minute per session

---

## 2. CSRF Protection

### Server-Side

**Files:**
- `/apps/web/src/lib/csrf.ts` - CSRF utilities
- `/apps/web/src/app/api/csrf/route.ts` - Token endpoint

**Implementation:**
- Double Submit Cookie pattern
- Cryptographically secure token generation (32 bytes)
- SHA-256 hashing for timing-safe comparison
- HttpOnly cookies for security

**Protected Endpoints:**
- `POST /api/chats` - Create chat
- `DELETE /api/chats/[id]` - Delete chat
- `POST /api/chat/send` - Send message

### Client-Side

**File:** `/apps/web/src/lib/csrf-client.ts`

**Usage:**
```typescript
import { fetchWithCsrf } from '@/lib/csrf-client';

// Automatically includes CSRF token for POST/PUT/DELETE
const response = await fetchWithCsrf('/api/chats', {
  method: 'POST',
  body: JSON.stringify({ title: 'New Chat' }),
});
```

**Manual usage:**
```typescript
import { withCsrfToken } from '@/lib/csrf-client';

const response = await fetch('/api/chats', await withCsrfToken({
  method: 'POST',
  body: JSON.stringify({ title: 'New Chat' }),
}));
```

---

## 3. Route Protection

### Middleware

**File:** `/apps/web/src/middleware.ts`

**Implementation:**
- Cookie-based session validation
- Redirects unauthenticated users to sign-in
- Adds security headers to all responses

**Protected Routes:**
- `/dashboard/*`
- `/chat/*`
- `/settings/*`

**Security Headers:**
```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

---

## 4. Input Validation

### Validation Schemas

**File:** `/apps/web/src/lib/validation.ts`

**Schemas:**
- `chatIdSchema` - Validates Convex ID format
- `chatTitleSchema` - Max 200 chars, trimmed
- `messageContentSchema` - Max 50,000 chars
- `sendMessageSchema` - Complete message validation

**Usage Example:**
```typescript
import { chatIdSchema, createValidationErrorResponse } from '@/lib/validation';

const validation = chatIdSchema.safeParse(id);
if (!validation.success) {
  return createValidationErrorResponse(validation.error);
}
```

### Protected Endpoints

All API endpoints now validate inputs:
- Chat IDs are validated against Convex ID format
- Message content length is enforced
- Timestamps are properly coerced and validated
- Invalid inputs return 400 with detailed error messages

---

## 5. Rate Limiting Utility

### Implementation

**File:** `/apps/web/src/lib/rate-limit.ts`

**Features:**
- Generic rate limiter class
- IP extraction from headers
- Automatic bucket cleanup
- Memory leak prevention

**Usage:**
```typescript
import { RateLimiter, getClientIp } from '@/lib/rate-limit';

const limiter = new RateLimiter({
  limit: 10,
  windowMs: 60_000,
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const result = limiter.check(ip);

  if (result.limited) {
    return new Response('Too Many Requests', {
      status: 429,
      headers: { 'Retry-After': result.retryAfter.toString() }
    });
  }

  // Handle request...
}
```

---

## 6. Environment Variables

### Required Variables

```bash
# Auth Rate Limiting
AUTH_RATE_LIMIT=10              # Max auth requests per window
AUTH_RATE_WINDOW_MS=60000       # Auth rate limit window (1 minute)

# Chat Rate Limiting
CHAT_CREATE_RATE_LIMIT=10       # Max chat creation per window
CHAT_CREATE_WINDOW_MS=60000     # Chat creation window (1 minute)

# General
NODE_ENV=production             # Enables secure CSRF cookies
```

---

## 7. Security Best Practices

### For Developers

1. **Always validate inputs** - Use Zod schemas for all API endpoints
2. **Apply CSRF protection** - Use `withCsrfProtection` for state-changing endpoints
3. **Rate limit sensitive endpoints** - Especially auth and resource creation
4. **Use the validation utilities** - Don't write custom validation
5. **Check security headers** - Ensure middleware applies proper headers

### For Operations

1. **Monitor rate limits** - Watch for suspicious patterns
2. **Review logs** - Check for CSRF validation failures
3. **Update limits** - Adjust rate limits based on traffic
4. **Use HTTPS** - Secure cookies require HTTPS in production
5. **Database backups** - Regular backups for data recovery

### Known Limitations

1. **In-memory rate limiting** - Not suitable for multi-instance deployments
   - Solution: Use Redis or distributed cache
2. **CSRF in stateless apps** - Double Submit Cookie has edge cases
   - Solution: Consider Synchronizer Token Pattern for critical flows
3. **No request signing** - API requests aren't cryptographically signed
   - Solution: Implement HMAC signing for high-security endpoints

---

## 8. Testing

### Rate Limiting

```bash
# Test auth rate limiting
for i in {1..15}; do
  curl -X POST http://localhost:3000/api/auth/sign-in
done
# Should return 429 after 10 requests
```

### CSRF Protection

```bash
# Get CSRF token
TOKEN=$(curl -s http://localhost:3000/api/csrf | jq -r .token)

# Make request with token
curl -X POST http://localhost:3000/api/chats \
  -H "X-CSRF-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test"}'
```

### Input Validation

```bash
# Test invalid chat ID
curl -X DELETE http://localhost:3000/api/chats/invalid-id
# Should return 400 with validation error
```

---

## 9. Incident Response

### If CSRF Attack Detected

1. Check logs for patterns: `grep "CSRF validation failed" logs/*.log`
2. Identify affected endpoints and IPs
3. Consider rotating CSRF secrets (currently stateless)
4. Review and update CORS configuration

### If Rate Limit Bypass Detected

1. Check if using distributed deployment (needs Redis)
2. Review IP extraction logic (proxies, load balancers)
3. Lower rate limits temporarily
4. Implement additional verification (captcha, 2FA)

### If Input Validation Bypassed

1. Review validation schemas for gaps
2. Check for parser vulnerabilities
3. Update Zod to latest version
4. Add additional sanitization if needed

---

## 10. Future Improvements

### Short Term
- [ ] Add request ID tracking for better debugging
- [ ] Implement rate limiting dashboard
- [ ] Add CSRF token rotation
- [ ] Enhanced logging with structured events

### Long Term
- [ ] Redis-based rate limiting for horizontal scaling
- [ ] Request signing for API authentication
- [ ] Anomaly detection for unusual patterns
- [ ] SOC 2 compliance measures
- [ ] Penetration testing

---

## References

- [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP Input Validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- [OWASP Rate Limiting](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/10-Business_Logic_Testing/04-Test_for_Process_Timing)
- [MDN Security Headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers#security)
