# OpenRouter OAuth PKCE Integration Guide

This document provides a complete guide for the OpenRouter OAuth PKCE (Proof Key for Code Exchange) implementation.

## Overview

The OAuth PKCE flow provides a secure way for users to authenticate with OpenRouter without manually copying API keys. It's more secure than the client credentials flow and provides a better user experience.

## Architecture

### Flow Diagram

```
┌─────────┐                    ┌──────────────┐                  ┌────────────┐
│  User   │                    │   OpenChat   │                  │ OpenRouter │
└────┬────┘                    └──────┬───────┘                  └─────┬──────┘
     │                                │                                 │
     │ 1. Click "Connect"             │                                 │
     ├───────────────────────────────>│                                 │
     │                                │                                 │
     │                                │ 2. Generate code_verifier       │
     │                                │    and code_challenge           │
     │                                │    (SHA-256)                    │
     │                                │                                 │
     │                                │ 3. Store verifier in            │
     │                                │    sessionStorage               │
     │                                │                                 │
     │                                │ 4. Redirect to auth URL         │
     │                                ├────────────────────────────────>│
     │                                │    with code_challenge          │
     │                                │                                 │
     │ 5. User authorizes             │                                 │
     ├────────────────────────────────────────────────────────────────>│
     │                                │                                 │
     │                                │ 6. Redirect with auth code      │
     │<───────────────────────────────┴─────────────────────────────────┤
     │                                                                  │
     │ 7. Land on /openrouter/callback                                 │
     │    with ?code=XXX                                               │
     ├───────────────────────────────>│                                 │
     │                                │                                 │
     │                                │ 8. Retrieve code_verifier       │
     │                                │    from sessionStorage          │
     │                                │                                 │
     │                                │ 9. Exchange code + verifier     │
     │                                │    for API key                  │
     │                                ├────────────────────────────────>│
     │                                │                                 │
     │                                │ 10. Return API key              │
     │                                │<────────────────────────────────┤
     │                                │                                 │
     │                                │ 11. Encrypt & store key         │
     │                                │     in Convex database          │
     │                                │                                 │
     │                                │ 12. Clear sessionStorage        │
     │                                │                                 │
     │ 13. Redirect to dashboard      │                                 │
     │<───────────────────────────────┤                                 │
     │                                │                                 │
```

## Files Created

### 1. `/apps/web/src/lib/openrouter-oauth.ts`

Core PKCE utilities module containing:

- `generateCodeVerifier()`: Creates a cryptographically secure random string (32 bytes, base64url encoded)
- `generateCodeChallenge(verifier)`: Generates SHA-256 hash of verifier, base64url encoded
- `initiateOAuthFlow(callbackUrl)`: Starts the OAuth flow by:
  - Generating code verifier and challenge
  - Storing verifier in sessionStorage
  - Redirecting to OpenRouter authorization page
- `exchangeCodeForKey(code, verifier)`: Exchanges authorization code for API key
- `getStoredCodeVerifier()`: Retrieves verifier from sessionStorage
- `getStoredState()`: Retrieves CSRF protection state
- `clearOAuthState()`: Cleans up sessionStorage after flow completes

**Key Features:**
- Uses Web Crypto API for secure random generation and SHA-256 hashing
- Implements base64url encoding (RFC 7636 compliant)
- CSRF protection using state parameter
- Automatic cleanup of sensitive data

### 2. `/apps/web/src/app/openrouter/callback/page.tsx`

OAuth callback page component that:

- Receives authorization code from URL parameters
- Validates CSRF state parameter
- Retrieves code verifier from sessionStorage
- Exchanges code for API key
- Encrypts and stores key using existing infrastructure
- Provides user feedback (loading, success, error states)
- Redirects to dashboard on success

**Key Features:**
- Client-side only ("use client" directive)
- Beautiful loading states with spinner
- Success confirmation with checkmark icon
- Error handling with user-friendly messages
- Automatic redirect after success
- Manual return button on errors

### 3. `/apps/web/src/hooks/use-openrouter-oauth.ts`

React hook for easy integration:

```typescript
const { initiateLogin, isLoading, error } = useOpenRouterOAuth();

// Usage in component
<button onClick={initiateLogin} disabled={isLoading}>
  {isLoading ? 'Connecting...' : 'Connect with OAuth'}
</button>
```

**Returns:**
- `initiateLogin()`: Function to start OAuth flow
- `isLoading`: Boolean indicating if OAuth is in progress
- `error`: Error object if OAuth initiation fails

### 4. `/apps/web/src/components/settings/api-key-section-with-oauth.tsx`

Example integration component showing how to add OAuth to existing UI:

**Features:**
- Primary OAuth button (recommended option)
- Alternative manual API key entry
- Smooth transitions between modes
- Consistent error handling
- Analytics tracking (PostHog events)
- Uses existing encryption and storage infrastructure

## Integration Steps

### Step 1: Add OAuth Button to Settings

Replace or update your existing API key section:

```typescript
import { ApiKeySectionWithOAuth } from "@/components/settings/api-key-section-with-oauth";

// In your settings component:
<ApiKeySectionWithOAuth
  hasStoredKey={hasKey}
  onKeyChanged={() => {
    // Refresh key status
  }}
/>
```

### Step 2: Configure Environment Variables

Ensure `NEXT_PUBLIC_APP_URL` is set in your `.env.local`:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

For production:
```bash
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### Step 3: Test the Flow

1. Navigate to settings
2. Click "Connect with OpenRouter OAuth"
3. Authorize on OpenRouter
4. Verify redirect to `/openrouter/callback`
5. Confirm successful storage and redirect to dashboard

## Security Considerations

### PKCE (Proof Key for Code Exchange)

PKCE prevents authorization code interception attacks:

1. **Code Verifier**: Random string generated client-side, never sent to auth server
2. **Code Challenge**: SHA-256 hash of verifier, sent to auth server
3. **Verification**: Auth server verifies the verifier matches the challenge when exchanging code

### State Parameter

Protects against CSRF attacks:
- Random state generated and stored in sessionStorage
- State sent with auth request
- State validated on callback to ensure request originated from this session

### Encryption

API keys are encrypted before storage:
- Client-side encryption using Web Crypto API
- AES-GCM with 256-bit keys
- User-specific encryption keys derived from user ID
- Keys stored encrypted in Convex database

### Storage Security

- **sessionStorage**: Used only during OAuth flow, automatically cleared
- **Convex Database**: Stores encrypted keys only
- **No localStorage**: Avoids persistence across sessions for OAuth state

## API Reference

### OpenRouter Endpoints

#### Authorization Endpoint
```
GET https://openrouter.ai/auth
  ?callback_url=<CALLBACK_URL>
  &code_challenge=<CODE_CHALLENGE>
  &code_challenge_method=S256
  &state=<STATE>
```

#### Token Exchange Endpoint
```
POST https://openrouter.ai/api/v1/auth/keys
Content-Type: application/json

{
  "code": "<AUTH_CODE>",
  "code_verifier": "<CODE_VERIFIER>",
  "code_challenge_method": "S256"
}

Response:
{
  "key": "sk-or-v1-..."
}
```

## Error Handling

### Common Errors

1. **"No authorization code received"**
   - User cancelled authorization
   - Network error during redirect
   - Solution: Try again

2. **"Invalid state parameter"**
   - Possible CSRF attack
   - sessionStorage cleared between requests
   - Solution: Restart OAuth flow

3. **"Code verifier not found"**
   - sessionStorage cleared or browser restriction
   - Different browser window/tab
   - Solution: Restart OAuth flow

4. **"Failed to exchange code for API key"**
   - Network error
   - Code already used (codes are single-use)
   - Invalid code_verifier
   - Solution: Restart OAuth flow

### Error Recovery

All errors are handled gracefully:
- User-friendly error messages
- Automatic cleanup of OAuth state
- Option to return to dashboard
- Errors logged for debugging

## Testing

### Manual Testing Checklist

- [ ] OAuth initiation works
- [ ] Redirect to OpenRouter succeeds
- [ ] Authorization on OpenRouter works
- [ ] Callback page loads correctly
- [ ] Code exchange succeeds
- [ ] Key is encrypted and stored
- [ ] Redirect to dashboard works
- [ ] Key is available in settings
- [ ] Key works for API calls
- [ ] Error states display correctly
- [ ] CSRF protection works (test with invalid state)
- [ ] sessionStorage is cleared after completion

### Unit Testing

Example test for code verifier generation:

```typescript
import { generateCodeVerifier, generateCodeChallenge } from '@/lib/openrouter-oauth';

describe('PKCE utilities', () => {
  it('generates valid code verifier', () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toHaveLength(43); // 32 bytes base64url encoded
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('generates consistent challenge for same verifier', async () => {
    const verifier = 'test-verifier';
    const challenge1 = await generateCodeChallenge(verifier);
    const challenge2 = await generateCodeChallenge(verifier);
    expect(challenge1).toBe(challenge2);
  });
});
```

## Troubleshooting

### sessionStorage Issues

If sessionStorage is not persisting:
1. Check browser privacy settings
2. Ensure not in private/incognito mode
3. Verify same origin policy

### Redirect Issues

If redirect fails:
1. Check `NEXT_PUBLIC_APP_URL` is correctly set
2. Verify callback URL matches exactly
3. Check for CORS issues in browser console

### Database Issues

If key storage fails:
1. Verify user is authenticated
2. Check Convex connection
3. Ensure user has valid Convex user ID

## Best Practices

1. **Always use HTTPS in production** - OAuth requires secure connections
2. **Set short expiry on authorization codes** - Codes should be single-use and short-lived
3. **Validate state parameter** - Always check CSRF protection
4. **Clear sensitive data** - Clean up sessionStorage after flow completes
5. **Provide user feedback** - Show loading states and clear error messages
6. **Log errors** - Use logging service for debugging production issues
7. **Track analytics** - Monitor OAuth success/failure rates

## Future Enhancements

Potential improvements:

1. **Token Refresh**: Implement refresh token flow if OpenRouter adds support
2. **Scope Selection**: Allow users to select OAuth scopes if OpenRouter adds support
3. **Multiple Accounts**: Support connecting multiple OpenRouter accounts
4. **Account Linking**: Link existing manual keys to OAuth accounts
5. **Revocation**: Add ability to revoke OAuth tokens from settings
6. **SSO Integration**: Support enterprise SSO providers

## Support

For issues or questions:
- Check browser console for detailed error messages
- Review Convex logs for backend errors
- Check OpenRouter API status
- File issue in repository with error details

## References

- [RFC 7636 - PKCE for OAuth 2.0](https://tools.ietf.org/html/rfc7636)
- [OpenRouter API Documentation](https://openrouter.ai/docs)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [OAuth 2.0 Security Best Practices](https://tools.ietf.org/html/draft-ietf-oauth-security-topics)
