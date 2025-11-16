# OpenRouter OAuth PKCE Flow - Visual Diagram

## Complete Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USER INITIATES OAUTH FLOW                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ User clicks "Connect OpenRouter"
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    useOpenRouterOAuth Hook (Client)                         │
│                                                                              │
│  const { initiateLogin } = useOpenRouterOAuth();                           │
│  initiateLogin() called                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ Calls initiateOAuthFlow()
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    openrouter-oauth.ts (PKCE Utils)                         │
│                                                                              │
│  1. Generate code_verifier (32 random bytes)                               │
│     → "ZjY4MjQ1N2YtMGE5NC00ZTYzLWI0YWQtOGE2YmJkNDc"                        │
│                                                                              │
│  2. Generate code_challenge (SHA-256 of verifier)                          │
│     → SHA-256(verifier)                                                     │
│     → "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"                        │
│                                                                              │
│  3. Generate state (CSRF protection)                                        │
│     → "a1b2c3d4e5f6g7h8"                                                    │
│                                                                              │
│  4. Store in sessionStorage                                                 │
│     sessionStorage.setItem('openrouter_code_verifier', verifier)          │
│     sessionStorage.setItem('openrouter_oauth_state', state)               │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ Redirect to OpenRouter
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         OpenRouter Authorization                            │
│                                                                              │
│  URL: https://openrouter.ai/auth?                                          │
│       callback_url=http://localhost:3000/openrouter/callback              │
│       &code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM         │
│       &code_challenge_method=S256                                          │
│       &state=a1b2c3d4e5f6g7h8                                              │
│                                                                              │
│  User logs in to OpenRouter                                                │
│  User authorizes the application                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ OpenRouter redirects back
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Redirect to Callback Page                               │
│                                                                              │
│  URL: http://localhost:3000/openrouter/callback?                          │
│       code=AUTH_CODE_FROM_OPENROUTER                                       │
│       &state=a1b2c3d4e5f6g7h8                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ Page loads
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│              /app/openrouter/callback/page.tsx (Client)                     │
│                                                                              │
│  1. Extract code and state from URL params                                 │
│     code = searchParams.get('code')                                        │
│     state = searchParams.get('state')                                      │
│                                                                              │
│  2. Validate CSRF state                                                     │
│     storedState = getStoredState()                                         │
│     if (state !== storedState) throw Error('CSRF attack')                 │
│                                                                              │
│  3. Retrieve code verifier                                                  │
│     codeVerifier = getStoredCodeVerifier()                                 │
│     → "ZjY4MjQ1N2YtMGE5NC00ZTYzLWI0YWQtOGE2YmJkNDc"                        │
│                                                                              │
│  4. Exchange code for API key                                              │
│     apiKey = await exchangeCodeForKey(code, codeVerifier)                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ POST to OpenRouter
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     OpenRouter Token Exchange API                           │
│                                                                              │
│  POST https://openrouter.ai/api/v1/auth/keys                              │
│  Content-Type: application/json                                            │
│                                                                              │
│  Body:                                                                      │
│  {                                                                          │
│    "code": "AUTH_CODE_FROM_OPENROUTER",                                   │
│    "code_verifier": "ZjY4MjQ1N2YtMGE5NC00ZTYzLWI0YWQtOGE2YmJkNDc",        │
│    "code_challenge_method": "S256"                                         │
│  }                                                                          │
│                                                                              │
│  OpenRouter validates:                                                      │
│  - code is valid and not expired                                           │
│  - SHA-256(code_verifier) matches stored code_challenge                   │
│                                                                              │
│  Response:                                                                  │
│  {                                                                          │
│    "key": "sk-or-v1-1234567890abcdef..."                                  │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ Return API key
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│              /app/openrouter/callback/page.tsx (Client)                     │
│                                                                              │
│  5. Encrypt API key                                                         │
│     encryptedKey = await encryptApiKey(apiKey, user.id)                   │
│     Uses: AES-GCM, 256-bit key, user-specific encryption                  │
│                                                                              │
│  6. Save to database                                                        │
│     await saveOpenRouterKey(apiKey, convexUser._id, user.id, convex)      │
│                                                                              │
│  7. Clear OAuth state                                                       │
│     clearOAuthState()                                                       │
│     sessionStorage.removeItem('openrouter_code_verifier')                 │
│     sessionStorage.removeItem('openrouter_oauth_state')                   │
│                                                                              │
│  8. Show success message                                                    │
│     setStatus('success')                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ Wait 1.5 seconds
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Redirect to Dashboard                                 │
│                                                                              │
│  router.push('/dashboard')                                                 │
│                                                                              │
│  User can now use OpenRouter API with stored key                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Security Validation Points

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SECURITY CHECKPOINTS                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ✓ PKCE Protection                                                          │
│    - Code verifier never leaves client                                      │
│    - Code challenge sent to auth server                                     │
│    - Server validates verifier matches challenge                            │
│    - Prevents authorization code interception                               │
│                                                                              │
│  ✓ CSRF Protection                                                          │
│    - Random state generated and stored                                      │
│    - State sent with auth request                                           │
│    - State validated on callback                                            │
│    - Prevents cross-site request forgery                                    │
│                                                                              │
│  ✓ Encryption at Rest                                                       │
│    - API key encrypted before storage                                       │
│    - AES-GCM with 256-bit keys                                              │
│    - User-specific encryption keys                                          │
│    - Keys never stored in plaintext                                         │
│                                                                              │
│  ✓ Secure Storage                                                           │
│    - sessionStorage for OAuth flow only                                     │
│    - Automatic cleanup after completion                                     │
│    - Database stores encrypted keys only                                    │
│    - No sensitive data in localStorage                                      │
│                                                                              │
│  ✓ HTTPS Requirement                                                        │
│    - All production traffic uses HTTPS                                      │
│    - Prevents man-in-the-middle attacks                                     │
│    - Ensures secure data transmission                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             ERROR SCENARIOS                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        │                             │                             │
        ▼                             ▼                             ▼
┌─────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│ No Auth Code    │         │ Invalid State    │         │ Exchange Failed  │
│                 │         │                  │         │                  │
│ User cancelled  │         │ CSRF detected    │         │ Network error    │
│ Network error   │         │ State mismatch   │         │ Invalid code     │
│                 │         │                  │         │                  │
│ Show error msg  │         │ Show error msg   │         │ Show error msg   │
│ Clear state     │         │ Clear state      │         │ Clear state      │
│ Offer retry     │         │ Offer retry      │         │ Offer retry      │
└─────────────────┘         └──────────────────┘         └──────────────────┘
        │                             │                             │
        └─────────────────────────────┼─────────────────────────────┘
                                      │
                                      ▼
                        ┌──────────────────────────┐
                        │   User-Friendly Error    │
                        │                          │
                        │ - Clear error message    │
                        │ - Recovery instructions  │
                        │ - Return to dashboard    │
                        │ - Automatic cleanup      │
                        └──────────────────────────┘
```

## Data Flow Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA LIFECYCLE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. code_verifier                                                           │
│     Generated → Stored in sessionStorage → Used for exchange → Deleted     │
│                                                                              │
│  2. code_challenge                                                          │
│     Generated → Sent to OpenRouter → Validated → Discarded                 │
│                                                                              │
│  3. state                                                                    │
│     Generated → Stored in sessionStorage → Validated → Deleted             │
│                                                                              │
│  4. authorization code                                                       │
│     Received from OpenRouter → Used once → Discarded                        │
│                                                                              │
│  5. API key                                                                  │
│     Received from OpenRouter → Encrypted → Stored in DB → Used for API      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component Integration Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            COMPONENT HIERARCHY                               │
└─────────────────────────────────────────────────────────────────────────────┘

Settings Page
    │
    └── ApiKeySectionWithOAuth Component
            │
            ├── useOpenRouterOAuth Hook
            │       │
            │       └── openrouter-oauth.ts (initiateOAuthFlow)
            │               │
            │               ├── generateCodeVerifier()
            │               ├── generateCodeChallenge()
            │               └── Redirect to OpenRouter
            │
            └── useOpenRouterKey Hook
                    │
                    └── openrouter-key-storage.ts
                            │
                            ├── saveOpenRouterKey()
                            ├── encryption.ts (encryptApiKey)
                            └── Convex mutation (users.saveOpenRouterKey)

OpenRouter Callback Page (/openrouter/callback)
    │
    ├── useSearchParams (get code & state)
    ├── useConvexUser (get user info)
    ├── openrouter-oauth.ts
    │       │
    │       ├── getStoredCodeVerifier()
    │       ├── getStoredState()
    │       ├── exchangeCodeForKey()
    │       └── clearOAuthState()
    │
    └── openrouter-key-storage.ts
            │
            └── saveOpenRouterKey()
```

## File Dependencies

```
openrouter-oauth.ts
    ↓ (no dependencies - standalone utility)

use-openrouter-oauth.ts
    ↓ depends on
    ├── openrouter-oauth.ts (initiateOAuthFlow)
    └── lib/logger.ts (logError)

callback/page.tsx
    ↓ depends on
    ├── openrouter-oauth.ts (exchangeCodeForKey, getStoredCodeVerifier, etc.)
    ├── openrouter-key-storage.ts (saveOpenRouterKey)
    ├── contexts/convex-user-context.tsx (useConvexUser)
    ├── lib/auth-client.ts (authClient)
    ├── lib/logger.ts (logError)
    └── components/logo.tsx (Logo)

api-key-section-with-oauth.tsx
    ↓ depends on
    ├── use-openrouter-oauth.ts (useOpenRouterOAuth)
    ├── use-openrouter-key.ts (useOpenRouterKey)
    ├── lib/posthog.ts (captureClientEvent)
    └── lib/logger.ts (logError)
```

## Testing Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TESTING SEQUENCE                                   │
└─────────────────────────────────────────────────────────────────────────────┘

1. Unit Tests (openrouter-oauth.test.ts)
   ├── Test generateCodeVerifier()
   ├── Test generateCodeChallenge()
   ├── Test base64url encoding
   └── Test PKCE flow integration

2. Integration Test
   ├── Click "Connect OpenRouter"
   ├── Verify redirect to OpenRouter
   ├── Authorize on OpenRouter
   ├── Verify callback receives code
   ├── Verify code exchange succeeds
   ├── Verify key is encrypted
   ├── Verify key is stored in DB
   └── Verify redirect to dashboard

3. Security Testing
   ├── Test CSRF protection (invalid state)
   ├── Test code reuse (use code twice)
   ├── Test without verifier
   └── Test encryption/decryption

4. Error Testing
   ├── Test user cancellation
   ├── Test network errors
   ├── Test invalid codes
   └── Test database errors
```
